"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      business_name: z.string().trim().min(2).max(80),
      inspection_weekday: int(0, 6),
      default_daily_rate: z.number().int().min(1000).max(1_000_000),
      default_daily_installment: z.number().int().min(0).max(1_000_000),
      payment_reminder_time: z.string().regex(/^\d{2}:\d{2}$/),
      first_service_min_km: int(0, 100000),
      first_service_km: int(1, 100000),
      oil_change_interval_km: int(100, 100000),
      general_service_interval_km: int(100, 100000),
      maintenance_alert_km: int(0, 10000),
    })
    .safeParse({
      business_name: String(formData.get("business_name") ?? ""),
      inspection_weekday: formData.get("inspection_weekday"),
      default_daily_rate: parseCOP(String(formData.get("default_daily_rate") ?? "")),
      default_daily_installment: parseCOP(String(formData.get("default_daily_installment") ?? "")),
      payment_reminder_time: String(formData.get("payment_reminder_time") ?? "19:00"),
      first_service_min_km: formData.get("first_service_min_km"),
      first_service_km: formData.get("first_service_km"),
      oil_change_interval_km: formData.get("oil_change_interval_km"),
      general_service_interval_km: formData.get("general_service_interval_km"),
      maintenance_alert_km: formData.get("maintenance_alert_km"),
    });
  if (!parsed.success) return fail("Revisa los valores: " + (parsed.error.issues[0]?.path.join(".") ?? ""));
  if (parsed.data.first_service_min_km > parsed.data.first_service_km) {
    return fail("El inicio de la primera revisión no puede ser mayor al límite.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Configuración guardada.");
}

export async function createAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      full_name: z.string().trim().min(3, "Escribe el nombre"),
      email: z.string().trim().email("Correo inválido"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    })
    .safeParse({
      full_name: String(formData.get("full_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_user", {
    p_email: parsed.data.email,
    p_password: parsed.data.password,
    p_full_name: parsed.data.full_name,
    p_role: "admin",
    p_phone: null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/admin/configuracion");
  return done("Administrador creado. Ya puede entrar con su correo y contraseña.");
}

export async function saveEmailSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const key = String(formData.get("resend_api_key") ?? "").trim();
  const from = String(formData.get("email_from") ?? "").trim();
  if (key && !/^re_[A-Za-z0-9_]{10,}$/.test(key)) return fail("La clave de Resend empieza por re_");
  const supabase = await createClient();
  if (key || formData.get("clear") === "1") {
    const { error } = await supabase.rpc("admin_set_app_config", { p_key: "resend_api_key", p_value: formData.get("clear") === "1" ? "" : key });
    if (error) return fail(dbError(error));
  }
  if (from) {
    const { error } = await supabase.rpc("admin_set_app_config", { p_key: "email_from", p_value: from });
    if (error) return fail(dbError(error));
  }
  revalidatePath("/admin/configuracion");
  return done("Correo configurado.");
}

export async function sendTestNotification(): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_test_notification");
  if (error) return fail(dbError(error));
  return done("Notificación de prueba enviada. Debería llegar en unos segundos.");
}

/** Storage folders that belong to a driver (flat: <bucket>/<driverId>/<file>). */
const DRIVER_BUCKETS = ["receipts", "inspections", "damages", "documents", "contracts"] as const;

async function emptyFolder(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string, folder: string) {
  for (let round = 0; round < 20; round++) {
    const { data } = await supabase.storage.from(bucket).list(folder, { limit: 100 });
    const files = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (!files.length) return;
    const { error } = await supabase.storage.from(bucket).remove(files);
    if (error) return;
  }
}

/**
 * Deletes the TEST data (plates PRU01A-03A, phones 3000000001-3) and the files
 * they uploaded. Real data is never touched (enforced in the SQL function).
 */
export async function purgeTestData(): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_purge_test_data");
  if (error) return fail(dbError(error, "No se pudieron borrar los datos de prueba."));
  const r = (data ?? {}) as { motorcycles?: number; drivers?: number; payments?: number; driver_folders?: string[]; moto_folders?: string[] };
  for (const id of r.driver_folders ?? []) {
    for (const bucket of DRIVER_BUCKETS) await emptyFolder(supabase, bucket, id);
  }
  for (const id of r.moto_folders ?? []) {
    await emptyFolder(supabase, "documents", `moto/${id}`);
    await emptyFolder(supabase, "documents", `incidents/${id}`);
  }
  revalidatePath("/admin", "layout");
  return done(
    `Listo. Se borraron ${r.motorcycles ?? 0} motos, ${r.drivers ?? 0} conductores y ${r.payments ?? 0} pagos de prueba con sus fotos.`,
  );
}
