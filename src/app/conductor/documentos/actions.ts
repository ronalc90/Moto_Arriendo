"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

const schema = z.object({
  doc_type: z.enum(["national_id", "license", "background_check", "other"], { message: "Elige el tipo de documento" }),
  expires_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  file: z.string().min(1, "Sube la foto del documento"),
  back_file: z.string(),
});

export async function uploadMyDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getDriverContext();
  const parsed = schema.safeParse({
    doc_type: formData.get("doc_type"),
    expires_on: String(formData.get("expires_on") ?? ""),
    file: String(formData.get("file") ?? ""),
    back_file: String(formData.get("back_file") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  if (!isValidUploadPath(parsed.data.file, ctx.driver.id, DOC_EXT)) return fail("El archivo no es válido.");
  const twoSided = ["national_id", "license"].includes(parsed.data.doc_type);
  if (twoSided && !parsed.data.back_file) return fail("Sube también la foto del reverso.");
  if (parsed.data.back_file && !isValidUploadPath(parsed.data.back_file, ctx.driver.id, DOC_EXT)) {
    return fail("El archivo del reverso no es válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    entity: "driver",
    driver_id: ctx.driver.id,
    doc_type: parsed.data.doc_type,
    expires_on: parsed.data.expires_on || null,
    file_path: parsed.data.file,
    back_file_path: twoSided ? parsed.data.back_file : parsed.data.back_file || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/conductor/documentos");
  return done("Documento enviado. El administrador lo revisa y te avisa.");
}
