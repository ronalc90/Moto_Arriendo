"use server";

import { redirect } from "next/navigation";
import { getProfile, needsOnboarding } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { authPasswordError, ownPasswordProblem } from "@/lib/passwords";
import { dbError } from "@/lib/action-state";
import { DOC_EXT, isValidUploadPath } from "@/lib/storage";

export type WelcomeState = { error?: string; values?: Record<string, string> };

const FIELDS = [
  "full_name",
  "phone",
  "national_id",
  "license_number",
  "license_category",
  "license_expires_on",
  "emergency_contact_name",
  "emergency_contact_phone",
] as const;

/** First sign-in: the driver's own data and their own password. */
export async function completeWelcome(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const profile = await getProfile();
  if (!profile || profile.role !== "driver" || !profile.active) redirect("/salir?error=sin-acceso");
  if (!profile.data_consent_at) redirect("/consentimiento");
  if (!needsOnboarding(profile)) redirect("/conductor");

  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "").trim()]));
  const supabase = await createClient();

  // 1) Own data (validated again in the database) + photos of cédula and license
  if (!profile.onboarded_at) {
    const { data: driver } = await supabase.from("drivers").select("id").eq("profile_id", profile.id).single();
    if (!driver) return { error: "No encontramos tu registro de conductor. Habla con el administrador.", values };
    const photos = {
      id_front: String(formData.get("id_front") ?? ""),
      id_back: String(formData.get("id_back") ?? ""),
      lic_front: String(formData.get("lic_front") ?? ""),
      lic_back: String(formData.get("lic_back") ?? ""),
    };
    for (const [key, path] of Object.entries(photos)) {
      if (!path) {
        const what = key.startsWith("id") ? "la cédula" : "la licencia";
        const side = key.endsWith("front") ? "el frente" : "el reverso";
        return { error: `Falta la foto de ${side} de ${what}.`, values };
      }
      if (!isValidUploadPath(path, driver.id, DOC_EXT)) return { error: "Alguna foto no es válida. Tómala de nuevo.", values };
    }

    const { error } = await supabase.rpc("complete_driver_onboarding", {
      p_full_name: values.full_name,
      p_phone: values.phone,
      p_national_id: values.national_id,
      p_license_number: values.license_number,
      p_license_category: values.license_category,
      p_license_expires_on: values.license_expires_on || null,
      p_emergency_contact_name: values.emergency_contact_name,
      p_emergency_contact_phone: values.emergency_contact_phone,
    });
    if (error) return { error: dbError(error, "No pudimos guardar tus datos. Revísalos e intenta de nuevo."), values };

    const { error: docError } = await supabase.from("documents").insert([
      { entity: "driver", driver_id: driver.id, doc_type: "national_id", file_path: photos.id_front, back_file_path: photos.id_back },
      {
        entity: "driver",
        driver_id: driver.id,
        doc_type: "license",
        file_path: photos.lic_front,
        back_file_path: photos.lic_back,
        expires_on: values.license_expires_on || null,
      },
    ]);
    if (docError) return { error: dbError(docError, "Tus datos quedaron guardados, pero no las fotos. Súbelas en Mis documentos."), values };
  }

  // 2) Own password, replacing the one the admin gave them
  if (profile.must_change_password) {
    const password = String(formData.get("password") ?? "");
    const problem = ownPasswordProblem(password, String(formData.get("confirm") ?? ""));
    if (problem) return { error: problem, values };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: authPasswordError(error.message), values };
    // The database checks that the password really changed before clearing the flag.
    const { error: markError } = await supabase.rpc("mark_password_changed");
    if (markError) return { error: dbError(markError, "No pudimos guardar tu contraseña. Intenta de nuevo."), values };
  }

  redirect("/conductor?bienvenido=1");
}
