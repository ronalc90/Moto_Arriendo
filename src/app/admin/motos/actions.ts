"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";

const optionalInt = z.union([z.literal(""), z.coerce.number().int().min(0)]);
const schema = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9]{5,8}$/, "La placa debe tener entre 5 y 8 letras/números (ej: ABC12D)")),
  brand: z.string().trim().min(2, "Escribe la marca"),
  model: z.string().trim().min(1, "Escribe el modelo"),
  year: optionalInt,
  engine_cc: optionalInt,
  color: z.string().trim().max(40),
  owner_id: z.string().uuid("Elige el propietario"),
  purchase_price: z.number().int().min(0),
  purchase_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  gps_provider: z.string().trim().max(80),
  current_km: z.coerce.number().int().min(0).max(999999),
  status: z.enum(["active", "in_shop", "impounded", "inactive"]),
  notes: z.string().max(1000),
});

function parse(formData: FormData) {
  return schema.safeParse({
    plate: String(formData.get("plate") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    year: String(formData.get("year") ?? ""),
    engine_cc: String(formData.get("engine_cc") ?? ""),
    color: String(formData.get("color") ?? ""),
    owner_id: formData.get("owner_id"),
    purchase_price: parseCOP(String(formData.get("purchase_price") ?? "")),
    purchase_date: String(formData.get("purchase_date") ?? ""),
    gps_provider: String(formData.get("gps_provider") ?? ""),
    current_km: String(formData.get("current_km") ?? "0").replace(/\D/g, "") || "0",
    status: formData.get("status") ?? "active",
    notes: String(formData.get("notes") ?? ""),
  });
}

function toRow(d: z.infer<typeof schema>) {
  return {
    plate: d.plate,
    brand: d.brand,
    model: d.model,
    year: d.year === "" ? null : d.year,
    engine_cc: d.engine_cc === "" ? null : d.engine_cc,
    color: d.color || null,
    owner_id: d.owner_id,
    purchase_price: d.purchase_price || null,
    purchase_date: d.purchase_date || null,
    gps_provider: d.gps_provider || null,
    current_km: d.current_km,
    status: d.status,
    notes: d.notes || null,
  };
}

export async function createMotorcycle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const supabase = await createClient();
  const { data, error } = await supabase.from("motorcycles").insert(toRow(parsed.data)).select("id").single();
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  redirect(`/admin/motos/${data.id}`);
}

export async function updateMotorcycle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const supabase = await createClient();
  const { error } = await supabase.from("motorcycles").update(toRow(parsed.data)).eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Moto actualizada.");
}
