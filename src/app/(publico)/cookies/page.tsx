import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSION_DATE, OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de cookies" };

export default function CookiesPage() {
  return (
    <>
      <h1>Política de cookies</h1>
      <p className="text-sm">Vigente desde el {LEGAL_VERSION_DATE}.</p>
      <p>
        Las cookies son pequeños archivos que un sitio guarda en tu navegador. {OWNER.business}{" "}
        <strong>solo usa las estrictamente necesarias</strong> para que la app funcione. No usamos cookies de publicidad,
        de analítica ni de redes sociales, y no compartimos esta información con terceros para fines comerciales.
      </p>

      <h2>Qué usamos</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Para qué</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>sb-…-auth-token</td>
            <td>Cookie necesaria (propia)</td>
            <td>Mantener tu sesión iniciada de forma segura.</td>
            <td>Mientras dure la sesión; se renueva al usar la app y se borra al cerrar sesión.</td>
          </tr>
          <tr>
            <td>ma-cookie-notice-v1</td>
            <td>Almacenamiento local</td>
            <td>Recordar que ya viste este aviso de cookies.</td>
            <td>Hasta que borres los datos del navegador.</td>
          </tr>
          <tr>
            <td>Caché de la app (service worker)</td>
            <td>Almacenamiento local</td>
            <td>Guardar íconos y archivos de la app para que cargue rápido e instalarla en el celular. No guarda tus datos personales.</td>
            <td>Hasta que se actualice la app o borres los datos.</td>
          </tr>
        </tbody>
      </table>

      <h2>Cómo controlarlas</h2>
      <p>
        Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueas la cookie de sesión no
        podrás iniciar sesión en la app.
      </p>

      <h2>Contacto</h2>
      <p>
        Si tienes preguntas escribe a <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>. Consulta también nuestra{" "}
        <Link href="/privacidad">política de tratamiento de datos personales</Link>.
      </p>
    </>
  );
}
