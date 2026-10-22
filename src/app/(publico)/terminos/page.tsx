import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSION_DATE, OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos de uso" };

export default function TermsPage() {
  return (
    <>
      <h1>Términos de uso de la app</h1>
      <p className="text-sm">Vigentes desde el {LEGAL_VERSION_DATE}.</p>
      <p>
        Estos términos regulan el uso de la app de <strong>{OWNER.business}</strong>, operada por {OWNER.name} en{" "}
        {OWNER.city}. El arriendo de cada motocicleta se rige por el <strong>contrato firmado</strong> entre las partes;
        si algo de esta app contradice el contrato, prevalece el contrato.
      </p>

      <h2>1. Quién puede usarla</h2>
      <p>
        Solo los conductores con contrato vigente o terminado y los administradores. Las cuentas las crea el
        administrador; no hay registro abierto. La cuenta es personal: no compartas tu contraseña.
      </p>

      <h2>2. Pagos y comprobantes</h2>
      <ul>
        <li>Un pago queda en firme cuando el administrador lo aprueba, después de verificar que el dinero llegó.</li>
        <li>Subir comprobantes falsos o alterados es causal de terminación del contrato, sin perjuicio de las acciones legales.</li>
        <li>
          El saldo, los días de atraso y el semáforo se calculan automáticamente con las condiciones de tu contrato y la
          hora de Bogotá. Si crees que hay un error, escríbenos y lo revisamos.
        </li>
      </ul>

      <h2>3. Inspecciones, daños y documentos</h2>
      <p>
        El conductor se compromete a enviar la inspección semanal con fotos reales y el kilometraje correcto, a reportar
        cualquier daño apenas ocurra y a mantener vigente su licencia de conducción.
      </p>

      <h2>4. Disponibilidad</h2>
      <p>
        Hacemos lo posible para que la app esté disponible siempre, pero puede haber interrupciones por mantenimiento o
        fallas de internet. Si no puedes subir un pago, guarda el comprobante y súbelo apenas puedas, o envíalo al
        administrador por otro medio.
      </p>

      <h2>5. Datos personales</h2>
      <p>
        El uso de tus datos se rige por nuestra <Link href="/privacidad">política de tratamiento de datos personales</Link> y
        nuestra <Link href="/cookies">política de cookies</Link>.
      </p>

      <h2>6. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Para cualquier inquietud escribe a{" "}
        <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>.
      </p>
    </>
  );
}
