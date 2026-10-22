import { ExternalLink, Wrench } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Collapsible } from "@/components/collapsible";
import { DeleteButton } from "@/components/delete-button";
import { FileUpload } from "@/components/file-upload";
import { Badge, Card, EmptyState, Field, Input, SectionTitle, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { bogotaToday, formatCOP, formatDate } from "@/lib/format";
import { MAINTENANCE_LABEL } from "@/lib/constants";
import { addMaintenance, deleteMaintenance } from "./maintenance-actions";

type Due = { service_type: string; next_km: number; km_left: number; status: "ok" | "soon" | "due" | "overdue" };
type Record_ = {
  id: string;
  service_type: string;
  performed_on: string;
  km: number;
  description: string | null;
  workshop: string | null;
  cost: number;
  paid_by: "driver" | "owner";
  invoice_path: string | null;
};

/** Maintenance by kilometers: next services + history with invoice, cost and payer. */
export async function MaintenanceSection({ motorcycleId, currentKm }: { motorcycleId: string; currentKm: number }) {
  const supabase = await createClient();
  const [{ data: due }, { data: records }] = await Promise.all([
    supabase.from("maintenance_due").select("*").eq("motorcycle_id", motorcycleId),
    supabase
      .from("maintenance_records")
      .select("*")
      .eq("motorcycle_id", motorcycleId)
      .order("performed_on", { ascending: false })
      .limit(20),
  ]);
  const list = (records as Record_[]) ?? [];
  const urls = await signedUrls("documents", list.map((r) => r.invoice_path));

  const tone = (s: Due["status"]) => (s === "overdue" ? "bad" : s === "soon" || s === "due" ? "warn" : "ok");
  const label = (s: Due["status"]) =>
    s === "overdue" ? "Atrasado" : s === "due" ? "Ya toca" : s === "soon" ? "Próximo" : "Al día";

  return (
    <>
      <SectionTitle>Mantenimiento</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {((due as Due[]) ?? []).map((d) => (
          <Card key={d.service_type} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{MAINTENANCE_LABEL[d.service_type]}</p>
              <Badge tone={tone(d.status)}>{label(d.status)}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              A los {d.next_km.toLocaleString("es-CO")} km ·{" "}
              {d.km_left > 0 ? `faltan ${d.km_left.toLocaleString("es-CO")} km` : `pasado por ${Math.abs(d.km_left).toLocaleString("es-CO")} km`}
            </p>
          </Card>
        ))}
      </div>

      {list.length ? (
        <Card className="mt-3 divide-y divide-line p-0">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Wrench className="size-5 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {MAINTENANCE_LABEL[r.service_type]} · {r.km.toLocaleString("es-CO")} km
                </p>
                <p className="text-xs text-ink-2">
                  {formatDate(r.performed_on)}
                  {r.workshop ? ` · ${r.workshop}` : ""}
                  {r.description ? ` · ${r.description}` : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold tabular">{formatCOP(r.cost)}</p>
                <p className="text-xs text-ink-2">Pagó {r.paid_by === "owner" ? "propietario" : "conductor"}</p>
              </div>
              {r.invoice_path && urls.get(r.invoice_path) ? (
                <a href={urls.get(r.invoice_path)} target="_blank" rel="noreferrer" className="p-2 text-ink-2" aria-label="Ver factura">
                  <ExternalLink className="size-5" />
                </a>
              ) : null}
              <DeleteButton action={deleteMaintenance} id={r.id} />
            </div>
          ))}
        </Card>
      ) : (
        <div className="mt-3">
          <EmptyState title="Sin servicios registrados." />
        </div>
      )}

      <div className="mt-3">
        <Collapsible title="Registrar servicio o arreglo">
          <ActionForm action={addMaintenance} submitLabel="Guardar" submitSize="md" resetOnSuccess>
            <input type="hidden" name="motorcycle_id" value={motorcycleId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo" htmlFor="service_type">
                <Select id="service_type" name="service_type" defaultValue="oil_change">
                  {Object.entries(MAINTENANCE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha" htmlFor="performed_on">
                <Input id="performed_on" name="performed_on" type="date" defaultValue={bogotaToday()} />
              </Field>
              <Field label="Kilometraje" htmlFor="km">
                <Input id="km" name="km" inputMode="numeric" defaultValue={currentKm} />
              </Field>
              <Field label="Costo" htmlFor="cost">
                <Input id="cost" name="cost" inputMode="numeric" placeholder="35.000" />
              </Field>
              <Field label="¿Quién pagó?" htmlFor="paid_by">
                <Select id="paid_by" name="paid_by" defaultValue="owner">
                  <option value="owner">Propietario (desgaste normal, arreglos grandes)</option>
                  <option value="driver">Conductor (aceite, mantenimiento menor, mal uso)</option>
                </Select>
              </Field>
              <Field label="Taller" htmlFor="workshop">
                <Input id="workshop" name="workshop" />
              </Field>
            </div>
            <Field label="Detalle" htmlFor="description">
              <Input id="description" name="description" placeholder="Ej: cambio de aceite 20W50 y filtro" />
            </Field>
            <FileUpload name="invoice" bucket="documents" folder={`expenses/${motorcycleId}`} kind="document" label="Factura (foto o PDF)" />
          </ActionForm>
        </Collapsible>
      </div>
    </>
  );
}
