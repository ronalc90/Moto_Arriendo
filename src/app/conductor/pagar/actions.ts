"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDriverContext } from "@/lib/driver";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

const schema = z.object({
  amount: z.number().int().min(1000, "El monto mínimo es $1.000").max(5_000_000, "El monto es demasiado alto"),
  method: z.enum(["nequi", "daviplata", "transfer", "cash"], { message: "Elige cómo pagaste" }),
  receipt: z.string(),
});

/** Driver submits a payment. The database assigns the fee/loan split and sets it as pending. */
export async function submitPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getDriverContext();
  if (!ctx.contract) return fail("No tienes un contrato vigente.");

  const parsed = schema.safeParse({
    amount: parseCOP(String(formData.get("amount") ?? "")),
    method: formData.get("method"),
    receipt: String(formData.get("receipt") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");

  const { amount, method, receipt } = parsed.data;
  if (method !== "cash" && !receipt) return fail("Toma la foto del comprobante.");
  if (receipt && !isValidUploadPath(receipt, ctx.driver.id, DOC_EXT)) return fail("El comprobante no es válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    contract_id: ctx.contract.id,
    driver_id: ctx.driver.id,
    motorcycle_id: ctx.contract.motorcycle_id,
    total_amount: amount,
    method,
    receipt_path: receipt || null,
    status: "pending",
  });
  if (error) return fail(dbError(error, "No se pudo enviar el pago. Intenta de nuevo."));

  revalidatePath("/conductor", "layout");
  return done("¡Pago enviado! El administrador lo revisará pronto.");
}
