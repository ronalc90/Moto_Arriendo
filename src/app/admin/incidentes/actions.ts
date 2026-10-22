"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

const party = z.enum(["driver", "owner", "third_party", "insurer", "pending"]);
const schema = z.object({
  motorcycle_id: z.string().uuid("Elige la moto"),
  driver_id: z.union([z.literal(""), z.string().uuid()]),
  kind: z.enum(["accident", "fine", "impound", "theft", "other"]),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  description: z.string().trim().min(4, "Describe lo que pasó").max(3000),
  responsible: party,
  cost: z.number().int().min(0).max(500_000_000),
  paid_by: party,
  reference: z.string().max(120),
});

function read(formData: FormData) {
  return {
    motorcycle_id: formData.get("motorcycle_id"),
    driver_id: String(formData.get("driver_id") ?? ""),
    kind: formData.get("kind"),
    occurred_on: formData.get("occurred_on"),
    description: String(formData.get("description") ?? ""),
    responsible: formData.get("responsible") ?? "pending",
    cost: parseCOP(String(formData.get("cost") ?? "")),
    paid_by: formData.get("paid_by") ?? "pending",
    reference: String(formData.get("reference") ?? ""),
  };
}

function files(formData: FormData, motorcycleId: string) {
  const out: string[] = [];
  for (const v of formData.getAll("files")) {
    const p = String(v);
    if (!p) continue;
    if (!isValidUploadPath(p, `incidents/${motorcycleId}`, DOC_EXT)) return null;
    out.push(p);
  }
  return out;
}

export async function createIncident(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse(read(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  const list = files(formData, d.motorcycle_id);
  if (!list) return fail("Uno de los archivos no es válido.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({ ...d, driver_id: d.driver_id || null, reference: d.reference || null, files: list })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  redirect(`/admin/incidentes/${data.id}`);
}

export async function updateIncident(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = z
    .object({
      responsible: party,
      paid_by: party,
      cost: z.number().int().min(0).max(500_000_000),
      status: z.enum(["open", "closed"]),
      resolution_notes: z.string().max(3000),
      reference: z.string().max(120),
    })
    .safeParse({
      responsible: formData.get("responsible"),
      paid_by: formData.get("paid_by"),
      cost: parseCOP(String(formData.get("cost") ?? "")),
      status: formData.get("status"),
      resolution_notes: String(formData.get("resolution_notes") ?? ""),
      reference: String(formData.get("reference") ?? ""),
    });
  if (!parsed.success) return fail("Revisa los datos");
  const supabase = await createClient();
  const { data: current } = await supabase.from("incidents").select("motorcycle_id, files, status, kind").eq("id", id).single();
  if (!current) return fail("Incidente no encontrado.");
  const extra = files(formData, current.motorcycle_id);
  if (!extra) return fail("Uno de los archivos no es válido.");
  const { error } = await supabase
    .from("incidents")
    .update({
      ...parsed.data,
      reference: parsed.data.reference || null,
      resolution_notes: parsed.data.resolution_notes || null,
      files: [...(current.files ?? []), ...extra],
      closed_at: parsed.data.status === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return fail(dbError(error));
  // An impound that gets closed frees the motorcycle again.
  if (current.kind === "impound" && current.status === "open" && parsed.data.status === "closed") {
    await supabase.from("motorcycles").update({ status: "active" }).eq("id", current.motorcycle_id).eq("status", "impounded");
  }
  revalidatePath("/admin", "layout");
  return done("Incidente actualizado.");
}
