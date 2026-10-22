import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import Link from "next/link";
import { ConsentForm } from "./consent-form";
import { OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Tratamiento de datos" };

export default async function ConsentPage() {
  const profile = await getProfile();
  if (!profile) redirect("/salir?error=sin-acceso");
  if (profile.role !== "driver" || profile.data_consent_at) redirect("/");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Autorización de tratamiento de datos personales</h1>
      <p className="mt-1 text-sm text-ink-2">Hola {profile.full_name.split(" ")[0]}. Antes de empezar, lee y acepta esta autorización.</p>

      <article className="mt-5 space-y-3 rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink-2">
        <p>
          En cumplimiento de la <strong className="text-ink">Ley 1581 de 2012</strong> y el Decreto 1377 de 2013,
          autorizo de manera previa, expresa e informada a <strong className="text-ink">{OWNER.name}</strong>{" "}
          ({OWNER.business}, {OWNER.city}, {OWNER.email}), en adelante el Responsable, para recolectar, almacenar, usar y suprimir mis datos personales con las
          siguientes finalidades:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Celebrar y ejecutar el contrato de arriendo de la motocicleta.</li>
          <li>Verificar mi identidad, mi licencia de conducción y mis antecedentes.</li>
          <li>Registrar y controlar los pagos, abonos, saldos y atrasos.</li>
          <li>Conocer la ubicación de la motocicleta mediante GPS y su estado mediante inspecciones con fotos.</li>
          <li>Contactarme a mí o a mi contacto de emergencia por llamada, mensaje, correo o notificaciones.</li>
          <li>Atender accidentes, multas, reclamaciones de seguros y requerimientos de autoridades.</li>
        </ul>
        <p>
          Entiendo que los datos de mi cédula, licencia y antecedentes, y las fotos que suba, se guardan en
          servidores seguros con acceso restringido al Responsable y a mí, operados por proveedores que pueden estar
          fuera de Colombia (Supabase y Vercel, en Estados Unidos), y autorizo esa transmisión. No es obligatorio
          responder preguntas sobre datos sensibles.
        </p>
        <p>
          Como titular tengo derecho a conocer, actualizar, rectificar y solicitar la supresión de mis datos, a
          pedir prueba de esta autorización, a ser informado sobre el uso que se les da, a revocar la autorización
          cuando no exista un deber legal o contractual de conservarlos, y a presentar quejas ante la
          Superintendencia de Industria y Comercio. Puedo ejercer estos derechos escribiendo a {OWNER.email}.
        </p>
        <p>
          Leí la{" "}
          <Link href="/privacidad" className="font-semibold text-info" target="_blank">
            política de tratamiento de datos personales
          </Link>{" "}
          y la{" "}
          <Link href="/cookies" className="font-semibold text-info" target="_blank">
            política de cookies
          </Link>
          .
        </p>
      </article>

      <ConsentForm />
    </main>
  );
}
