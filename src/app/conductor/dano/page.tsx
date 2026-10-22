import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Badge, Card, Field, SectionTitle, Textarea } from "@/components/ui";
import { getDriverContext } from "@/lib/driver";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { DAMAGE_STATUS_LABEL } from "@/lib/constants";
import type { DamageReport } from "@/lib/types";
import { submitDamage } from "./actions";

export const metadata: Metadata = { title: "Reportar daño" };

export default async function DamagePage() {
  const ctx = await getDriverContext();
  if (!ctx.contract || !ctx.motorcycle) {
    return (
      <Card>
        <p className="text-ink-2">No tienes un contrato vigente.</p>
      </Card>
    );
  }
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("damage_reports")
    .select("*")
    .eq("driver_id", ctx.driver.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Reportar daño</h1>
      <p className="mb-4 text-sm text-ink-2">Moto {ctx.motorcycle.plate}. Avisa apenas notes algo raro.</p>
      <Card>
        <ActionForm action={submitDamage} submitLabel="Enviar reporte" pendingLabel="Enviando…" resetOnSuccess>
          <Field label="¿Qué pasó?" htmlFor="description">
            <Textarea id="description" name="description" required placeholder="Ej: se rompió el espejo izquierdo, suena la cadena…" />
          </Field>
          <p className="text-sm font-medium">Fotos (hasta 4)</p>
          <div className="grid gap-2">
            {[1, 2, 3, 4].map((i) => (
              <FileUpload key={i} name={`photo_${i}`} bucket="damages" folder={ctx.driver.id} capture label={`Foto ${i}`} />
            ))}
          </div>
        </ActionForm>
      </Card>

      <SectionTitle>Mis reportes</SectionTitle>
      {reports?.length ? (
        <Card className="divide-y divide-line p-0">
          {(reports as DamageReport[]).map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink-2">{formatDate(r.reported_on)}</span>
                <Badge tone={r.status === "closed" ? "ok" : r.status === "in_repair" ? "info" : "warn"}>
                  {DAMAGE_STATUS_LABEL[r.status]}
                </Badge>
              </div>
              <p className="mt-1">{r.description}</p>
              {r.resolution_notes ? <p className="mt-1 text-sm text-ink-2">Respuesta: {r.resolution_notes}</p> : null}
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-2">No has reportado daños.</p>
        </Card>
      )}
    </>
  );
}
