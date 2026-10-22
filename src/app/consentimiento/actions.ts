"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Stores the acceptance date (Ley 1581 de 2012) for the signed-in user. */
export async function acceptDataPolicy(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  if (formData.get("accept") !== "on") {
    return { error: "Debes marcar la casilla para continuar." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_data_policy");
  if (error) {
    return { error: "No pudimos guardar tu aceptación. Intenta de nuevo." };
  }
  redirect("/conductor");
}
