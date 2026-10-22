"use server";

import { createClient } from "@/lib/supabase/server";
import { authPasswordError, ownPasswordProblem } from "@/lib/passwords";

export type PasswordState = { ok?: boolean; error?: string };

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = ownPasswordProblem(password, confirm);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authPasswordError(error.message) };
  await supabase.rpc("mark_password_changed");
  return { ok: true };
}
