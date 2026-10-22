import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, needsOnboarding } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Bienvenido" };

/** First sign-in of a driver: own data + own password before anything else. */
export default async function WelcomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/salir?error=sin-acceso");
  if (!profile.active) redirect("/salir?error=inactivo");
  if (profile.role !== "driver") redirect("/admin");
  if (!profile.data_consent_at) redirect("/consentimiento");
  if (!needsOnboarding(profile)) redirect("/conductor");

  const supabase = await createClient();
  const { data: driver } = await supabase
    .from("drivers")
    .select("national_id, license_number, license_category, license_expires_on, emergency_contact_name, emergency_contact_phone")
    .eq("profile_id", profile.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">¡Hola, {profile.full_name.split(" ")[0]}! 👋</h1>
      <p className="mt-1 text-[15px] text-ink-2">
        {profile.onboarded_at
          ? "Solo falta que elijas tu propia contraseña."
          : "Antes de empezar, completa tus datos. Solo se hace una vez."}
      </p>
      <WelcomeForm
        askData={!profile.onboarded_at}
        askPassword={profile.must_change_password}
        phoneLocked={!profile.username}
        initial={{
          full_name: profile.full_name,
          phone: profile.phone ?? "",
          national_id: driver?.national_id ?? "",
          license_number: driver?.license_number ?? "",
          license_category: driver?.license_category ?? "A2",
          license_expires_on: driver?.license_expires_on ?? "",
          emergency_contact_name: driver?.emergency_contact_name ?? "",
          emergency_contact_phone: driver?.emergency_contact_phone ?? "",
        }}
      />
    </main>
  );
}
