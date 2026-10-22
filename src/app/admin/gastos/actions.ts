"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { parseCOP } from "@/lib/format";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      motorcycle_id: z.string().uuid("Elige la moto"),
      category: z.enum(["soat", "insurance", "tech_inspection", "gps", "tax", "maintenance", "repair", "fine", "other"]),
      spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
      amount: z.number().int().min(100, "Escribe el valor").max(500_000_000),
      description: z.string().max(500),
      file: z.string(),
    })
    .safeParse({
      motorcycle_id: formData.get("motorcycle_id"),
      category: formData.get("category"),
      spent_on: formData.get("spent_on"),
      amount: parseCOP(String(formData.get("amount") ?? "")),
      description: String(formData.get("description") ?? ""),
      file: String(formData.get("file") ?? ""),
    });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const d = parsed.data;
  if (d.file && !isValidUploadPath(d.file, `expenses/${d.motorcycle_id}`, DOC_EXT)) return fail("El soporte no es válido.");
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    motorcycle_id: d.motorcycle_id,
    category: d.category,
    spent_on: d.spent_on,
    amount: d.amount,
    description: d.description || null,
    file_path: d.file || null,
  });
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Gasto registrado.");
}

export async function deleteExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", String(formData.get("id")));
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done();
}
