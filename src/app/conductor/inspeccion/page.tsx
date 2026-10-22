import type { Metadata } from "next";
import { Alert, Card } from "@/components/ui";
import { getDriverContext } from "@/lib/driver";
import { formatDate } from "@/lib/format";
import { InspectionWizard } from "./inspection-wizard";

export const metadata: Metadata = { title: "Inspección semanal" };

export default async function InspectionPage() {
  const ctx = await getDriverContext();
  if (!ctx.contract || !ctx.motorcycle) {
    return (
      <Card>
        <p className="text-ink-2">No tienes un contrato vigente.</p>
      </Card>
    );
  }
  const done = ctx.inspection?.done_this_week;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Inspección semanal</h1>
      <p className="mb-4 text-sm text-ink-2">
        Moto {ctx.motorcycle.plate} · 5 fotos, kilometraje y lista de chequeo (2 minutos)
      </p>
      {done ? (
        <div className="mb-4">
          <Alert tone="ok">
            Ya enviaste la inspección de esta semana
            {ctx.inspection?.last_inspection_on ? ` (${formatDate(ctx.inspection.last_inspection_on)})` : ""}. Puedes enviar otra si algo cambió.
          </Alert>
        </div>
      ) : null}
      <InspectionWizard driverId={ctx.driver.id} lastKm={ctx.motorcycle.current_km} />
    </>
  );
}
