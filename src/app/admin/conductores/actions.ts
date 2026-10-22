"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { normalizePhone, parseCOP } from "@/lib/format";

const optionalDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")]);
const base = {
  full_name: z.string().trim().min(3, "Escribe el nombre completo"),
  national_id: z.string().trim().min(4, "Escribe la cédula").max(20),
  license_number: z.string().trim().max(30),
  license_category: z.string().trim().max(10),
  license_expires_on: optionalDate,
  emergency_contact_name: z.string().trim().max(80),
  emergency_contact_phone: z.string().trim().max(20),
  referred_by: z.string().trim().max(80),
  deposit_amount: z.number().int().min(0).max(50_000_000),
  notes: z.string().max(2000),
};

function read(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    national_id: String(formData.get("national_id") ?? ""),
    license_number: String(formData.get("license_number") ?? ""),
    license_category: String(formData.get("license_category") ?? ""),
    license_expires_on: String(formData.get("license_expires_on") ?? ""),
    emergency_contact_name: String(formData.get("emergency_contact_name") ?? ""),
    emergency_contact_phone: String(formData.get("emergency_contact_phone") ?? ""),
    referred_by: String(formData.get("referred_by") ?? ""),
    deposit_amount: parseCOP(String(formData.get("deposit_amount") ?? "")),
    notes: String(formData.get("notes") ?? ""),
  };
}

const createSchema = z.object({
  ...base,
  phone: z.string().regex(/^\d{10}$/, "El celular debe tener 10 dígitos"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function createDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    ...read(formData),
    phone: normalizePhone(String(formData.get("phone") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_driver", {
    p_full_name: d.full_name,
    p_phone: d.phone,
    p_password: d.password,
    p_national_id: d.national_id,
    p_license_number: d.license_number || null,
    p_license_category: d.license_category || null,
    p_license_expires_on: d.license_expires_on || null,
    p_emergency_contact_name: d.emergency_contact_name || null,
    p_emergency_contact_phone: d.emergency_contact_phone || null,
    p_referred_by: d.referred_by || null,
    p_deposit_amount: d.deposit_amount,
    p_notes: d.notes || null,
  });
  if (error) return fail(dbError(error, "No se pudo crear el conductor."));
  revalidatePath("/admin", "layout");
  redirect(`/admin/conductores/${data}?nuevo=1`);
}

export async function updateDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = z.object(base).safeParse(read(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  const supabase = await createClient();
  const { data: driver } = await supabase.from("drivers").select("profile_id").eq("id", id).single();
  if (!driver) return fail("Conductor no encontrado.");
  const { error } = await supabase
    .from("drivers")
    .update({
      national_id: d.national_id,
      license_number: d.license_number || null,
      license_category: d.license_category || null,
      license_expires_on: d.license_expires_on || null,
      emergency_contact_name: d.emergency_contact_name || null,
      emergency_contact_phone: d.emergency_contact_phone || null,
      referred_by: d.referred_by || null,
      deposit_amount: d.deposit_amount,
      notes: d.notes || null,
    })
    .eq("id", id);
  if (error) return fail(dbError(error));
  const { error: pErr } = await supabase.from("profiles").update({ full_name: d.full_name }).eq("id", driver.profile_id);
  if (pErr) return fail(dbError(pErr));
  revalidatePath("/admin", "layout");
  return done("Datos guardados.");
}

export async function resetDriverPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const profileId = String(formData.get("profile_id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return fail("La contraseña debe tener al menos 8 caracteres.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_password", { p_user_id: profileId, p_password: password });
  if (error) return fail(dbError(error));
  return done("Contraseña asignada. Compártela con el conductor.");
}

export async function setDriverActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_driver_active", { p_driver_id: id, p_active: active });
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done(active ? "Conductor activado." : "Conductor desactivado: ya no puede entrar a la app.");
}
