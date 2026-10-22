import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: "admin" | "driver";
  active: boolean;
  data_consent_at: string | null;
};

/** Current user's profile (deduplicated per request). Null when signed out. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, role, active, data_consent_at")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

/** Requires an active admin; otherwise redirects. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  // The proxy already sends signed-out visitors to /login, so a missing
  // profile here means a signed-in account that was never authorized.
  if (!profile) redirect("/salir?error=sin-acceso");
  if (!profile.active) redirect("/salir?error=inactivo");
  if (profile.role !== "admin") redirect("/conductor");
  return profile;
}

/** Requires an active driver who accepted the data policy. */
export async function requireDriver(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/salir?error=sin-acceso");
  if (!profile.active) redirect("/salir?error=inactivo");
  if (profile.role !== "driver") redirect("/admin");
  if (!profile.data_consent_at) redirect("/consentimiento");
  return profile;
}
