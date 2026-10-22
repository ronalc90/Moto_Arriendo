import type { Metadata } from "next";
import { LEGAL_VERSION_DATE, OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de tratamiento de datos personales" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de tratamiento de datos personales</h1>
      <p className="text-sm">Vigente desde el {LEGAL_VERSION_DATE}.</p>
      <p>
        Esta política se expide en cumplimiento de la <strong>Ley 1581 de 2012</strong>, el Decreto 1377 de 2013
        (compilado en el Decreto 1074 de 2015) y demás normas de protección de datos personales en Colombia.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>
          Nombre: <strong>{OWNER.name}</strong>, quien opera la marca <strong>{OWNER.business}</strong>.
        </li>
        <li>Domicilio: {OWNER.city}.</li>
        <li>
          Correo para consultas y reclamos: <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>.
        </li>
      </ul>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li><strong>Identificación y contacto:</strong> nombre, cédula, celular, contacto de emergencia y quién lo refirió.</li>
        <li><strong>Habilitación para conducir:</strong> número, categoría y vencimiento de la licencia, y certificado de antecedentes.</li>
        <li><strong>Información del contrato y financiera:</strong> tarifa, pagos, comprobantes de pago, préstamos, abonos, saldos y depósito.</li>
        <li><strong>Información de la motocicleta:</strong> fotos de inspección, kilometraje, reportes de daño, incidentes y ubicación de la moto por GPS.</li>
        <li><strong>Datos técnicos:</strong> registros de ingreso a la app y, si la activa, la suscripción a notificaciones del celular.</li>
      </ul>
      <p>
        No tratamos datos de menores de edad. Los datos sensibles solo se piden cuando son necesarios para el contrato y
        el titular no está obligado a responder preguntas sobre ellos.
      </p>

      <h2>3. Finalidades</h2>
      <ol>
        <li>Celebrar, ejecutar y terminar el contrato de arriendo de la motocicleta.</li>
        <li>Verificar la identidad, la licencia de conducción y los antecedentes del conductor.</li>
        <li>Registrar y controlar pagos, abonos, saldos, atrasos y préstamos.</li>
        <li>Cuidar la motocicleta: ubicación por GPS, inspecciones con fotos, mantenimiento y atención de daños.</li>
        <li>Atender accidentes, multas, inmovilizaciones, robos, reclamaciones a aseguradoras y requerimientos de autoridades.</li>
        <li>Enviar avisos y recordatorios (notificaciones en la app, mensajes, correo o llamadas) al titular o a su contacto de emergencia.</li>
        <li>Cumplir obligaciones legales, contables y tributarias.</li>
      </ol>

      <h2>4. Cómo protegemos los datos</h2>
      <p>
        La información se guarda en servidores con acceso restringido, cifrado en tránsito y controles de acceso por
        usuario: cada conductor solo puede ver su propia información, y los documentos y fotos se guardan en
        almacenamiento privado al que solo se accede con enlaces temporales. Se lleva un registro de quién aprueba o
        modifica la información.
      </p>
      <p>
        Para operar la plataforma usamos proveedores que actúan como <strong>encargados del tratamiento</strong> y cuyos
        servidores pueden estar fuera de Colombia (principalmente en Estados Unidos): Supabase (base de datos y archivos),
        Vercel (alojamiento de la app) y, si se activa, Resend (envío de correos). Estos proveedores solo tratan los datos
        para prestarnos su servicio. Al aceptar esta política, el titular autoriza esta transmisión internacional.
      </p>

      <h2>5. Derechos del titular</h2>
      <ul>
        <li>Conocer, actualizar y rectificar sus datos.</li>
        <li>Pedir prueba de la autorización que otorgó.</li>
        <li>Ser informado sobre el uso que se da a sus datos.</li>
        <li>Revocar la autorización o pedir la supresión de sus datos, cuando no exista un deber legal o contractual de conservarlos.</li>
        <li>Acceder gratuitamente a sus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) después de haber agotado el trámite con el responsable.</li>
      </ul>

      <h2>6. Cómo ejercer sus derechos</h2>
      <p>
        Escriba a <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a> indicando su nombre, cédula, lo que solicita y un
        dato de contacto.
      </p>
      <ul>
        <li><strong>Consultas:</strong> se responden en máximo 10 días hábiles (prorrogables por 5 días hábiles más, informando el motivo).</li>
        <li><strong>Reclamos</strong> (corrección, actualización, supresión o incumplimiento): se responden en máximo 15 días hábiles (prorrogables por 8 días hábiles más, informando el motivo).</li>
      </ul>

      <h2>7. Conservación</h2>
      <p>
        Los datos se conservan mientras dure la relación contractual y después durante el tiempo necesario para cumplir
        las finalidades descritas y las obligaciones legales, contables y tributarias.
      </p>

      <h2>8. Autorización</h2>
      <p>
        Al ingresar por primera vez a la app, el conductor otorga su autorización previa, expresa e informada, y la
        plataforma guarda la fecha y hora de la aceptación como prueba.
      </p>

      <h2>9. Cambios a esta política</h2>
      <p>
        Cualquier cambio sustancial se informará por la app antes de entrar en vigencia. La versión vigente siempre
        estará publicada en esta página.
      </p>
    </>
  );
}
