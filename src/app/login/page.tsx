import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  inactivo: "Tu cuenta está desactivada. Habla con el administrador.",
  "sin-acceso": "Esta cuenta no tiene acceso. Pide al administrador que te cree un usuario.",
  salida: "Cerraste sesión.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="flex min-h-dvh flex-col bg-asphalt">
      <div className="flex flex-1 flex-col items-center justify-center px-5 pt-12 pb-8 text-center">
        <Image src="/icons/icon-192.png" alt="" width={84} height={84} className="rounded-3xl" priority />
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#f5f4ef]">Moto Arriendo</h1>
        <p className="mt-2 max-w-xs text-[15px] text-[#c3c6cc]">
          Pagos, inspecciones y documentos de tu moto en un solo lugar.
        </p>
      </div>
      <div className="safe-bottom rounded-t-3xl bg-bg px-5 pt-7 pb-8 sm:mx-auto sm:mb-10 sm:w-full sm:max-w-md sm:rounded-3xl">
        <LoginForm notice={error ? NOTICES[error] : undefined} />
        <p className="mt-6 text-center text-xs text-ink-3">
          ¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.
        </p>
      </div>
    </main>
  );
}
