import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Card, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, bogotaToday, WEEKDAYS, weekday } from "@/lib/format";

export const metadata: Metadata = { title: "Hoy" };

export default async function AdminTodayPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const today = bogotaToday();

  const [motos, drivers, contracts] = await Promise.all([
    supabase.from("motorcycles").select("id", { count: "exact", head: true }),
    supabase.from("drivers").select("id", { count: "exact", head: true }),
    supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  return (
    <>
      <PageHeader
        title={`Hola, ${profile.full_name.split(" ")[0]}`}
        subtitle={`${WEEKDAYS[weekday(today)]} ${formatDate(today)} · hora de Bogotá`}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Motos" value={motos.count ?? 0} />
        <Stat label="Conductores" value={drivers.count ?? 0} />
        <Stat label="Contratos vigentes" value={contracts.count ?? 0} />
      </div>
      <Card className="mt-5">
        <h2 className="font-semibold">Fase 0 lista</h2>
        <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
          {[
            "Base de datos creada con seguridad por filas (RLS) en todas las tablas",
            "Archivos privados (comprobantes, documentos, fotos) con enlaces que expiran",
            "Inicio de sesión de administrador funcionando",
            "App instalable en el celular (PWA)",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
