"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, done, fail, type ActionState } from "@/lib/action-state";

export async function reviewInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("review_notes") ?? "").slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase
    .from("inspections")
    .update({ reviewed_at: new Date().toISOString(), review_notes: notes || null })
    .eq("id", id);
  if (error) return fail(dbError(error));
  revalidatePath("/admin", "layout");
  return done("Inspección marcada como revisada.");
}
