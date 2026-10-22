import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { Card } from "@/components/ui";
import { formatDateTime, formatPhone } from "@/lib/format";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/salir?error=sin-acceso");
  const home = profile.role === "admin" ? "/admin" : "/conductor";

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-6">
      <Link href={home} className="inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Mi cuenta</h1>

      <Card className="mt-4 space-y-1 text-[15px]">
        <p className="font-semibold">{profile.full_name}</p>
        <p className="text-ink-2">
          {profile.role === "admin" ? `Administrador · ${profile.email}` : `Conductor · ${formatPhone(profile.phone)}`}
        </p>
        {profile.data_consent_at ? (
          <p className="text-xs text-ink-3">Aceptaste el tratamiento de datos el {formatDateTime(profile.data_consent_at)}</p>
        ) : null}
      </Card>

      <h2 className="mt-7 mb-3 font-semibold">Cambiar contraseña</h2>
      <PasswordForm />

      <form action="/salir" method="post" className="mt-8">
        <button className="inline-flex items-center gap-2 text-[15px] font-medium text-bad">
          <LogOut className="size-5" /> Cerrar sesión
        </button>
      </form>
    </main>
  );
}
