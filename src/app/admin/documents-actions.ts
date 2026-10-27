"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")]);
const schema = z.object({
  entity: z.enum(["motorcycle", "driver"]),
  entity_id: z.string().uuid(),
  doc_type: z.enum([
    "soat", "insurance", "tech_inspection", "registration",
    "national_id", "license", "background_check", "contract", "other",
  ]),
  starts_on: date,
  expires_on: date,
  file: z.string(),
  back_file: z.string(),
  notes: z.string().max(300),
});
const TWO_SIDED = ["national_id", "license"];

/** Admin adds a document (with expiry date) to a motorcycle or a driver. */
export async function addDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    entity: formData.get("entity"),
    entity_id: formData.get("entity_id"),
    doc_type: formData.get("doc_type"),
    starts_on: String(formData.get("starts_on") ?? ""),
    expires_on: String(formData.get("expires_on") ?? ""),
    file: String(formData.get("file") ?? ""),
    back_file: String(formData.get("back_file") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  const prefix = d.entity === "motorcycle" ? `moto/${d.entity_id}` : d.entity_id;
  if (d.file && !isValidUploadPath(d.file, prefix, DOC_EXT)) return fail("El archivo no es válido.");
  if (d.back_file && !isValidUploadPath(d.back_file, prefix, DOC_EXT)) return fail("El archivo del reverso no es válido.");
  if (TWO_SIDED.includes(d.doc_type) && (!d.file || !d.back_file)) {
    return fail("Sube la foto de los dos lados (frente y reverso).");
  }
  if (!d.file && !d.expires_on) return fail("Sube el archivo o al menos registra la fecha de vencimiento.");
  if (["soat", "insurance", "tech_inspection"].includes(d.doc_type) && !d.expires_on) {
    return fail("Este documento necesita fecha de vencimiento para avisarte a tiempo.");
  }
  if (d.starts_on && d.expires_on && d.expires_on < d.starts_on) return fail("La fecha de vencimiento es anterior al inicio.");

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    entity: d.entity,
    motorcycle_id: d.entity === "motorcycle" ? d.entity_id : null,
    driver_id: d.entity === "driver" ? d.entity_id : null,
    doc_type: d.doc_type,
    starts_on: d.starts_on || null,
    expires_on: d.expires_on || null,
    file_path: d.file || null,
    back_file_path: d.back_file || null,
    notes: d.notes || null,
  });
  if (error) return fail(dbError(error));

  // A new license date also updates the driver record used for alerts.
  if (d.entity === "driver" && d.doc_type === "license" && d.expires_on) {
    await supabase.from("drivers").update({ license_expires_on: d.expires_on }).eq("id", d.entity_id);
  }
  revalidatePath("/admin", "layout");
  return done("Documento guardado.");
}

export async function deleteDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, back_file_path, entity, driver_id, motorcycle_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return fail(dbError(error));
  // Remove the file only when it lives in this document's own folder and no
  // other row still points to it (never trust a path someone else wrote).
  // The path is compared with .eq() (escaped by the client): a driver writes
  // file_path through the API, so it must never become part of a filter string.
  if (doc) {
    const owner = doc.entity === "motorcycle" ? `moto/${doc.motorcycle_id}/` : `${doc.driver_id}/`;
    for (const path of [doc.file_path, doc.back_file_path]) {
      if (!path || !path.startsWith(owner) || path.includes("..")) continue;
      const refs = await Promise.all(
        (["file_path", "back_file_path"] as const).map((column) =>
          supabase.from("documents").select("id", { count: "exact", head: true }).eq(column, path),
        ),
      );
      // Keep the file when in doubt (a failed count is not "nobody uses it").
      if (refs.some((r) => r.error || r.count === null || r.count > 0)) continue;
      await supabase.storage.from("documents").remove([path]);
    }
  }
  revalidatePath("/admin", "layout");
  return done("Documento eliminado.");
}

/** Admin checks a document a driver uploaded: approve, or reject with a reason. */
export async function reviewDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("review_notes") ?? "").trim();
  if (!["approved", "rejected"].includes(decision)) return fail("Elige aprobar o rechazar.");
  if (decision === "rejected" && notes.length < 3) return fail("Escribe por qué la rechazas (el conductor lo verá).");
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ review_status: decision, review_notes: decision === "rejected" ? notes : null })
    .eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done(decision === "approved" ? "Documento aprobado." : "Rechazado: le avisamos al conductor para que lo suba de nuevo.");
}
