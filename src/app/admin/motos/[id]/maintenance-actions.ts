"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

const schema = z.object({
  motorcycle_id: z.string().uuid(),
  service_type: z.enum(["first_service", "oil_change", "general_service", "repair", "other"]),
  performed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  km: z.coerce.number().int().min(0).max(999999),
  description: z.string().max(1000),
  workshop: z.string().max(120),
  cost: z.number().int().min(0).max(50_000_000),
  paid_by: z.enum(["driver", "owner"]),
  invoice: z.string(),
});

export async function addMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    motorcycle_id: formData.get("motorcycle_id"),
    service_type: formData.get("service_type"),
    performed_on: formData.get("performed_on"),
    km: String(formData.get("km") ?? "").replace(/\D/g, ""),
    description: String(formData.get("description") ?? ""),
    workshop: String(formData.get("workshop") ?? ""),
    cost: parseCOP(String(formData.get("cost") ?? "")),
    paid_by: formData.get("paid_by"),
    invoice: String(formData.get("invoice") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  if (d.invoice && !isValidUploadPath(d.invoice, `moto/${d.motorcycle_id}`, DOC_EXT)) return fail("La factura no es válida.");

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_records").insert({
    motorcycle_id: d.motorcycle_id,
    service_type: d.service_type,
    performed_on: d.performed_on,
    km: d.km,
    description: d.description || null,
    workshop: d.workshop || null,
    cost: d.cost,
    paid_by: d.paid_by,
    invoice_path: d.invoice || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Mantenimiento registrado.");
}

export async function deleteMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_records").delete().eq("id", String(formData.get("id")));
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done();
}
