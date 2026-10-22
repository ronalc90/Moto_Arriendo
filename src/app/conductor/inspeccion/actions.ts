"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { IMAGE_EXT, isValidUploadPath } from "@/lib/storage";

const check = z.enum(["ok", "check"], { message: "Marca cada punto de la lista" });
const schema = z.object({
  km: z.coerce.number().int("El kilometraje debe ser un número entero").min(0).max(999999),
  tires: check,
  brakes: check,
  chain: check,
  lights: check,
  oil: check,
  notes: z.string().max(1000).optional(),
});
const PHOTOS = ["photo_front", "photo_back", "photo_left", "photo_right", "photo_dashboard"] as const;

export async function submitInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getDriverContext();
  if (!ctx.contract || !ctx.motorcycle) return fail("No tienes un contrato vigente.");

  const parsed = schema.safeParse({
    km: String(formData.get("km") ?? "").replace(/\D/g, ""),
    tires: formData.get("tires"),
    brakes: formData.get("brakes"),
    chain: formData.get("chain"),
    lights: formData.get("lights"),
    oil: formData.get("oil"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");

  const photos: Record<string, string> = {};
  for (const key of PHOTOS) {
    const path = String(formData.get(key) ?? "");
    if (!isValidUploadPath(path, ctx.driver.id, IMAGE_EXT)) return fail("Faltan fotos. Toma las 5 fotos.");
    photos[key] = path;
  }
  if (parsed.data.km < ctx.motorcycle.current_km) {
    return fail(
      `El kilometraje no puede ser menor al último registrado (${ctx.motorcycle.current_km.toLocaleString("es-CO")} km).`,
    );
  }

  const { tires, brakes, chain, lights, oil } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("inspections").insert({
    driver_id: ctx.driver.id,
    motorcycle_id: ctx.motorcycle.id,
    contract_id: ctx.contract.id,
    km: parsed.data.km,
    checklist: { tires, brakes, chain, lights, oil },
    notes: parsed.data.notes || null,
    ...photos,
  });
  if (error) return fail(dbError(error, "No se pudo guardar la inspección."));

  revalidatePath("/conductor", "layout");
  return done("¡Inspección enviada!");
}
