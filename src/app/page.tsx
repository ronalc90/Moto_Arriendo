import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

/** Entry point: send each user to their own area. */
export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/salir?error=sin-acceso");
  if (!profile.active) redirect("/salir?error=inactivo");
  if (profile.role === "admin") redirect("/admin");
  if (!profile.data_consent_at) redirect("/consentimiento");
  redirect("/conductor");
}
