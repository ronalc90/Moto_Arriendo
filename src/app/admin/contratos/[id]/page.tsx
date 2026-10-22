import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Collapsible } from "@/components/collapsible";
import { FileUpload } from "@/components/file-upload";
import { PaymentCalendar, monthRange, parseMonth } from "@/components/payment-calendar";
import { Badge, ButtonLink, Card, Field, Input, PageHeader, SectionTitle, Stat, Textarea } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { WEEKDAYS, bogotaToday, formatCOP, formatDate, formatTime } from "@/lib/format";
import type { CalendarDay, Contract, ContractSummary } from "@/lib/types";
import { endContract, setContractFile, updateContractTerms } from "../actions";
import { ExemptDaysForm, ExemptDaysList } from "../../dias-exentos/exempt-components";

export const metadata: Metadata = { title: "Contrato" };

export default async function ContractDetailPage({ params, searchParams }: PageProps<"/admin/contratos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("*, motorcycles(plate, brand, model), drivers(id, profiles(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const c = data as Contract & {
    motorcycles: { plate: string; brand: string; model: string };
    drivers: { id: string; profiles: { full_name: string } };
  };

  const today = bogotaToday();
  const month = parseMonth(sp.mes, (c.end_date && c.end_date < today ? c.end_date : today).slice(0, 7));
  const { from, to } = monthRange(month);
  const [summaryRes, calRes, exemptRes, fileUrl] = await Promise.all([
    supabase.rpc("contract_summary", { p_contract_id: id }),
    supabase.rpc("contract_calendar", { p_contract_id: id, p_from: from, p_to: to }),
    supabase.from("exempt_days").select("*").eq("contract_id", id).order("day", { ascending: false }),
    signedUrl("contracts", c.file_path, 600),
  ]);
  const s = ((summaryRes.data as ContractSummary[] | null) ?? [])[0];

  return (
    <>
      <Link href="/admin/contratos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Contratos
      </Link>
      <PageHeader
        title={`${c.drivers.profiles.full_name} · ${c.motorcycles.plate}`}
        subtitle={`${formatCOP(c.daily_rate)}/día · desde ${formatDate(c.start_date)}${c.end_date ? ` hasta ${formatDate(c.end_date)}` : ""}`}
        action={c.status === "active" && s ? <LightBadge light={s.light} lateDays={s.late_days} /> : <Badge>Terminado</Badge>}
      />

      {s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Días cobrables" value={s.chargeable_days} hint={`hasta ${formatDate(s.last_due_date)}`} />
          <Stat label="Debería haber pagado" value={formatCOP(s.expected_rate)} />
          <Stat label="Pagado (tarifa)" value={formatCOP(s.paid_rate)} />
          <Stat
            label="Deuda total"
            value={formatCOP(s.total_debt)}
            tone={s.total_debt > 0 ? "bad" : "ok"}
            hint={s.installment_debt ? `incluye ${formatCOP(s.installment_debt)} de abonos` : s.rate_balance < 0 ? `adelanto ${formatCOP(-s.rate_balance)}` : undefined}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/admin/conductores/${c.drivers.id}`} variant="secondary" size="md">
          Ficha del conductor
        </ButtonLink>
        <ButtonLink href={`/admin/motos/${c.motorcycle_id}`} variant="secondary" size="md">
          Ficha de la moto
        </ButtonLink>
        {c.status === "active" ? (
          <ButtonLink href={`/admin/pagos/nuevo?contrato=${c.id}`} variant="secondary" size="md">
            Registrar pago
          </ButtonLink>
        ) : null}
      </div>

      <SectionTitle>Calendario de pagos</SectionTitle>
      <Card>
        <PaymentCalendar month={month} days={(calRes.data as CalendarDay[]) ?? []} basePath={`/admin/contratos/${id}`} />
      </Card>

      <SectionTitle>Condiciones</SectionTitle>
      <Card className="space-y-1 text-[15px]">
        <p>
          <span className="text-ink-2">Descanso:</span> {c.rest_weekdays.map((d) => WEEKDAYS[d]).join(", ") || "Ninguno"}
        </p>
        <p>
          <span className="text-ink-2">Hora límite:</span> {formatTime(c.payment_deadline)}
        </p>
        <p>
          <span className="text-ink-2">Devolución de la moto con:</span> {c.max_late_days} días de atraso
        </p>
        {c.notes ? (
          <p>
            <span className="text-ink-2">Notas:</span> {c.notes}
          </p>
        ) : null}
        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-semibold text-info">
            <ExternalLink className="size-4" /> Ver contrato firmado
          </a>
        ) : (
          <p className="mt-2 text-sm font-medium text-warn">Falta subir el contrato firmado.</p>
        )}
      </Card>

      <SectionTitle>Días exentos (no se cobran)</SectionTitle>
      <ExemptDaysList rows={exemptRes.data ?? []} />
      {c.status === "active" ? (
        <div className="mt-3">
          <Collapsible title="Marcar días exentos">
            <ExemptDaysForm contractId={id} />
          </Collapsible>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <Collapsible title={c.file_path ? "Reemplazar contrato firmado" : "Subir contrato firmado (PDF)"}>
          <ActionForm action={setContractFile} submitLabel="Guardar PDF" submitSize="md">
            <input type="hidden" name="id" value={id} />
            <FileUpload name="file" bucket="contracts" folder={c.drivers.id} kind="document" label="PDF o foto del contrato firmado" />
          </ActionForm>
        </Collapsible>
        <Collapsible title="Editar condiciones">
          <p className="mb-3 text-sm text-ink-2">
            La tarifa, el descanso y la fecha de inicio no se cambian en un contrato vigente porque alterarían toda la deuda
            calculada. Para cambiarlos, termina este contrato y crea uno nuevo.
          </p>
          <ActionForm action={updateContractTerms} submitLabel="Guardar" submitSize="md">
            <input type="hidden" name="id" value={id} />
            <Field label="Días de atraso para devolver la moto" htmlFor="max_late_days">
              <Input id="max_late_days" name="max_late_days" type="number" min={1} max={30} defaultValue={c.max_late_days} />
            </Field>
            <Field label="Notas" htmlFor="notes">
              <Textarea id="notes" name="notes" defaultValue={c.notes ?? ""} />
            </Field>
          </ActionForm>
        </Collapsible>
        {c.status === "active" ? (
          <Collapsible title="Terminar contrato">
            <p className="mb-3 text-sm text-ink-2">
              Se deja de cobrar desde el día siguiente a la fecha de terminación. La moto queda libre para otro contrato.
            </p>
            <ActionForm action={endContract} submitLabel="Terminar contrato" submitVariant="danger" submitSize="md">
              <input type="hidden" name="id" value={id} />
              <Field label="Último día cobrable" htmlFor="end_date">
                <Input id="end_date" name="end_date" type="date" defaultValue={today} required />
              </Field>
            </ActionForm>
          </Collapsible>
        ) : null}
      </div>
    </>
  );
}
