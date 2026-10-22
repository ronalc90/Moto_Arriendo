"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/conductor", "layout");
}

/** Approve a pending payment (optionally adjusting the fee/loan split). */
export async function approvePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const rate = parseCOP(String(formData.get("rate_amount") ?? ""));
  const inst = parseCOP(String(formData.get("installment_amount") ?? ""));
  const supabase = await createClient();

  const { data: payment } = await supabase.from("payments").select("*").eq("id", id).single();
  if (!payment) return fail("Pago no encontrado.");
  if (rate + inst !== payment.total_amount) {
    return fail(`Tarifa + abono debe sumar el total del pago.`);
  }

  let loanId = payment.loan_id as string | null;
  if (inst > 0 && !loanId) {
    const { data: loan } = await supabase
      .from("loans")
      .select("id")
      .eq("driver_id", payment.driver_id)
      .eq("status", "active")
      .order("loan_date")
      .limit(1)
      .maybeSingle();
    if (!loan) return fail("El conductor no tiene un préstamo activo para recibir el abono.");
    loanId = loan.id;
  }

  const { error } = await supabase
    .from("payments")
    .update({ status: "approved", rate_amount: rate, installment_amount: inst, loan_id: inst > 0 ? loanId : null })
    .eq("id", id);
  if (error) return fail(dbError(error));
  refresh();
  return done("Pago aprobado.");
}

/** Reject (or void an approved) payment with a reason. */
export async function rejectPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return fail("Escribe el motivo del rechazo.");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update({ status: "rejected", rejection_reason: reason }).eq("id", id);
  if (error) return fail(dbError(error));
  refresh();
  return done("Pago rechazado.");
}

/** Put a reviewed payment back to "pending". */
export async function reopenPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update({ status: "pending" }).eq("id", id);
  if (error) return fail(dbError(error));
  refresh();
  return done("El pago volvió a revisión.");
}

const manualSchema = z.object({
  contract_id: z.string().uuid("Elige el contrato"),
  kind: z.enum(["regular", "loan_only"]),
  amount: z.number().int().min(1000, "El monto mínimo es $1.000").max(10_000_000),
  method: z.enum(["nequi", "daviplata", "transfer", "cash"]),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  receipt: z.string(),
  notes: z.string().max(500),
});

/** Admin registers a payment directly (cash, or an extra loan installment). It is approved immediately. */
export async function createManualPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = manualSchema.safeParse({
    contract_id: formData.get("contract_id"),
    kind: formData.get("kind"),
    amount: parseCOP(String(formData.get("amount") ?? "")),
    method: formData.get("method"),
    paid_on: formData.get("paid_on"),
    receipt: String(formData.get("receipt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  if (d.receipt && !isValidUploadPath(d.receipt, "admin", DOC_EXT)) return fail("El comprobante no es válido.");

  const supabase = await createClient();
  const { data: contract } = await supabase.from("contracts").select("id, driver_id").eq("id", d.contract_id).single();
  if (!contract) return fail("Contrato no encontrado.");

  const row: Record<string, unknown> = {
    contract_id: d.contract_id,
    driver_id: contract.driver_id,
    motorcycle_id: "00000000-0000-0000-0000-000000000000", // replaced by the database trigger
    total_amount: d.amount,
    method: d.method,
    paid_on: d.paid_on,
    receipt_path: d.receipt || null,
    notes: d.notes || null,
    status: "approved",
  };

  if (d.kind === "loan_only") {
    const { data: loan } = await supabase
      .from("loan_balances")
      .select("id, balance")
      .eq("driver_id", contract.driver_id)
      .eq("status", "active")
      .order("loan_date")
      .limit(1)
      .maybeSingle();
    if (!loan) return fail("El conductor no tiene un préstamo activo.");
    if (d.amount > loan.balance) return fail(`El abono supera el saldo del préstamo (${loan.balance}).`);
    Object.assign(row, { rate_amount: 0, installment_amount: d.amount, loan_id: loan.id });
  } else {
    // Let the database split it (rate first, then loan).
    Object.assign(row, { rate_amount: 0, installment_amount: 0 });
  }

  const { data: created, error } = await supabase.from("payments").insert(row).select("id").single();
  if (error) return fail(dbError(error));
  refresh();
  redirect(`/admin/pagos/${created.id}`);
}
