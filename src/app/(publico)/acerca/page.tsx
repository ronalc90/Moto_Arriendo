import type { Metadata } from "next";
import { OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Quiénes somos" };

export default function AboutPage() {
  return (
    <>
      <h1>Quiénes somos</h1>
      <p>
        <strong>{OWNER.business}</strong> es un emprendimiento de <strong>{OWNER.name}</strong>, ubicado en{" "}
        {OWNER.city}. Arrendamos motocicletas <strong>Bajaj Boxer CT100</strong> nuevas a conductores de confianza
        que trabajan en aplicaciones de domicilios y transporte como Picap, DiDi, Uber Moto y Rappi.
      </p>

      <h2>Cómo funciona</h2>
      <ul>
        <li>El conductor paga una tarifa diaria por los días que trabaja y tiene un día de descanso a la semana sin cobro.</li>
        <li>Paga por Nequi o Daviplata antes de las 9:00 p. m. (hora de Bogotá) y sube el comprobante en esta app.</li>
        <li>
          Cada moto tiene GPS, SOAT y seguro todo riesgo. El conductor cubre gasolina, aceite, mantenimiento menor y
          daños por mal uso; nosotros cubrimos el desgaste normal, los arreglos grandes, el SOAT, el seguro y la
          revisión técnico-mecánica.
        </li>
        <li>Si el conductor lo necesita, podemos prestarle dinero (por ejemplo, para sacar el pase) que paga con un abono diario.</li>
      </ul>

      <h2>Esta plataforma</h2>
      <p>
        La app de {OWNER.business} fue desarrollada por {OWNER.name}, desarrollador de software full stack. Aquí los
        conductores suben sus pagos, las inspecciones semanales de la moto y sus documentos, y nosotros revisamos los
        pagos y controlamos los vencimientos. La información está protegida: cada conductor solo puede ver la suya.
      </p>

      <h2>Contacto</h2>
      <ul>
        <li>
          Responsable: <strong>{OWNER.name}</strong>
        </li>
        <li>Ciudad: {OWNER.city}</li>
        <li>
          Correo: <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>
        </li>
        <li>
          Web: <a href={OWNER.website} target="_blank" rel="noreferrer">{OWNER.website.replace("https://", "")}</a> ·{" "}
          <a href={OWNER.linkedin} target="_blank" rel="noreferrer">LinkedIn</a> ·{" "}
          <a href={OWNER.github} target="_blank" rel="noreferrer">GitHub</a>
        </li>
      </ul>
    </>
  );
}
