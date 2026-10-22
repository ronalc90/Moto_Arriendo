"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";

export async function updateDamage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["open", "in_repair", "closed"]),
      resolution_notes: z.string().max(1000),
    })
    .safeParse({
      id: formData.get("id"),
      status: formData.get("status"),
      resolution_notes: String(formData.get("resolution_notes") ?? ""),
    });
  if (!parsed.success) return fail("Revisa los datos");
  const supabase = await createClient();
  const { error } = await supabase
    .from("damage_reports")
    .update({ status: parsed.data.status, resolution_notes: parsed.data.resolution_notes || null })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  revalidatePath("/conductor/dano");
  return done("Reporte actualizado.");
}
