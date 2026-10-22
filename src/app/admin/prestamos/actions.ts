"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";

const schema = z.object({
  driver_id: z.string().uuid("Elige el conductor"),
  concept: z.string().trim().min(2, "Escribe el concepto").max(120),
  amount: z.number().int().min(1000, "Monto inválido").max(100_000_000),
  daily_installment: z.number().int().min(0).max(10_000_000),
  installment_required: z.boolean(),
  loan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  notes: z.string().max(1000),
});

export async function createLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    driver_id: formData.get("driver_id"),
    concept: String(formData.get("concept") ?? ""),
    amount: parseCOP(String(formData.get("amount") ?? "")),
    daily_installment: parseCOP(String(formData.get("daily_installment") ?? "")),
    installment_required: formData.get("installment_required") === "on",
    loan_date: formData.get("loan_date"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const supabase = await createClient();
  // One active loan per driver (a payment can only pay one loan). Point the
  // admin to the existing loan so they can add the new amount to it.
  const { data: active } = await supabase
    .from("loans")
    .select("id, concept")
    .eq("driver_id", parsed.data.driver_id)
    .eq("status", "active")
    .maybeSingle();
  if (active) {
    return fail(
      `Este conductor ya tiene un préstamo activo (${active.concept}). Ábrelo y usa "Editar préstamo" para sumarle el nuevo monto.`,
    );
  }
  const { data, error } = await supabase
    .from("loans")
    .insert({ ...parsed.data, notes: parsed.data.notes || null })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  redirect(`/admin/prestamos/${data.id}`);
}

export async function updateLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const amount = parseCOP(String(formData.get("amount") ?? ""));
  const installment = parseCOP(String(formData.get("daily_installment") ?? ""));
  const concept = String(formData.get("concept") ?? "").trim();
  if (concept.length < 2) return fail("Escribe el concepto.");
  if (amount < 1000) return fail("Monto inválido.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("loans")
    .update({
      concept,
      amount,
      daily_installment: installment,
      installment_required: formData.get("installment_required") === "on",
      notes: String(formData.get("notes") ?? "") || null,
    })
    .eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  revalidatePath("/conductor", "layout");
  return done("Préstamo actualizado.");
}
