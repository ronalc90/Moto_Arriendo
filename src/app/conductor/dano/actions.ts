"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { IMAGE_EXT, isValidUploadPath } from "@/lib/storage";

export async function submitDamage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getDriverContext();
  if (!ctx.contract || !ctx.motorcycle) return fail("No tienes un contrato vigente.");

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 5) return fail("Cuéntanos qué pasó (mínimo 5 letras).");
  if (description.length > 2000) return fail("La descripción es muy larga.");

  const photos: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const path = String(formData.get(`photo_${i}`) ?? "");
    if (!path) continue;
    if (!isValidUploadPath(path, ctx.driver.id, IMAGE_EXT)) return fail("Una de las fotos no es válida.");
    photos.push(path);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("damage_reports").insert({
    driver_id: ctx.driver.id,
    motorcycle_id: ctx.motorcycle.id,
    description,
    photos,
  });
  if (error) return fail(dbError(error, "No se pudo enviar el reporte."));
  revalidatePath("/conductor/dano");
  return done("Reporte enviado. El administrador lo revisará.");
}
