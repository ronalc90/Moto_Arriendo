"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";
import { addDays } from "@/lib/format";

const schema = z.object({
  contract_id: z.string().uuid("Elige el contrato"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inicial inválida"),
  to: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  reason: z.string().trim().min(3, "Escribe el motivo").max(200),
});

/** Marks one day or a range of days as not chargeable. */
export async function addExemptDays(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    contract_id: formData.get("contract_id"),
    from: formData.get("from"),
    to: String(formData.get("to") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
  const { contract_id, from, reason } = parsed.data;
  const to = parsed.data.to || from;
  if (to < from) return fail("La fecha final es anterior a la inicial.");

  const days: string[] = [];
  for (let d = from; d <= to && days.length <= 62; d = addDays(d, 1)) days.push(d);
  if (days.length > 62) return fail("Máximo 62 días por vez.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("exempt_days")
    .upsert(days.map((day) => ({ contract_id, day, reason })), { onConflict: "contract_id,day", ignoreDuplicates: true });
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  revalidatePath("/conductor", "layout");
  return done(days.length === 1 ? "Día marcado como exento." : `${days.length} días marcados como exentos.`);
}

export async function deleteExemptDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("exempt_days").delete().eq("id", String(formData.get("id")));
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  revalidatePath("/conductor", "layout");
  return done();
}
