"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const schema = z.object({
  driver_id: z.string().uuid("Elige el conductor"),
  motorcycle_id: z.string().uuid("Elige la moto"),
  daily_rate: z.number().int().min(1000, "La tarifa mínima es $1.000").max(1_000_000),
  rest_weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(6),
  payment_deadline: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  max_late_days: z.coerce.number().int().min(1).max(30),
  start_date: isoDate,
  file: z.string(),
  notes: z.string().max(2000),
});

export async function createContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    driver_id: formData.get("driver_id"),
    motorcycle_id: formData.get("motorcycle_id"),
    daily_rate: parseCOP(String(formData.get("daily_rate") ?? "")),
    rest_weekdays: formData.getAll("rest_weekdays"),
    payment_deadline: String(formData.get("payment_deadline") ?? "21:00"),
    max_late_days: formData.get("max_late_days") ?? 3,
    start_date: formData.get("start_date"),
    file: String(formData.get("file") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  if (d.file && !isValidUploadPath(d.file, d.driver_id, DOC_EXT)) return fail("El archivo del contrato no es válido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      driver_id: d.driver_id,
      motorcycle_id: d.motorcycle_id,
      daily_rate: d.daily_rate,
      rest_weekdays: [...new Set(d.rest_weekdays)].sort(),
      payment_deadline: d.payment_deadline,
      max_late_days: d.max_late_days,
      start_date: d.start_date,
      file_path: d.file || null,
      notes: d.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error, "No se pudo crear el contrato."));
  revalidatePath("/admin", "layout");
  redirect(`/admin/contratos/${data.id}`);
}

export async function setContractFile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const file = String(formData.get("file") ?? "");
  const supabase = await createClient();
  const { data: c } = await supabase.from("contracts").select("driver_id").eq("id", id).single();
  if (!c) return fail("Contrato no encontrado.");
  if (!isValidUploadPath(file, c.driver_id, DOC_EXT)) return fail("Sube el PDF del contrato firmado.");
  const { error } = await supabase.from("contracts").update({ file_path: file }).eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Contrato firmado guardado.");
}

export async function updateContractTerms(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const max = Number(formData.get("max_late_days"));
  if (!Number.isInteger(max) || max < 1 || max > 30) return fail("Días máximos de atraso inválidos.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ max_late_days: max, notes: String(formData.get("notes") ?? "") || null })
    .eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Contrato actualizado.");
}

export async function endContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const end = String(formData.get("end_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return fail("Elige la fecha de terminación.");
  const supabase = await createClient();
  const { data: c } = await supabase.from("contracts").select("start_date").eq("id", id).single();
  if (!c) return fail("Contrato no encontrado.");
  if (end < c.start_date) return fail("La fecha de terminación es anterior al inicio.");
  const { error } = await supabase.from("contracts").update({ status: "ended", end_date: end }).eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  redirect(`/admin/contratos/${id}?hecho=terminado`);
}

/** Change the daily rate from a date on; earlier days keep the old rate. */
export async function changeContractRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const from = String(formData.get("from") ?? "");
  const rate = parseCOP(String(formData.get("daily_rate") ?? ""));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return fail("Elige desde qué fecha aplica.");
  if (rate < 1000 || rate > 1_000_000) return fail("La tarifa debe estar entre $1.000 y $1.000.000.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_change_contract_rate", { p_contract_id: id, p_from: from, p_rate: rate });
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Tarifa actualizada. Los días anteriores conservan la tarifa que tenían.");
}
