import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Camera, ChevronRight, ClipboardCheck, ReceiptText } from "lucide-react";
import { Alert, Badge, ButtonLink, Card, SectionTitle } from "@/components/ui";
import { TrafficLight } from "@/components/traffic-light";
import { getDriverContext } from "@/lib/driver";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDate, formatTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import type { Payment } from "@/lib/types";

export const metadata: Metadata = { title: "Inicio" };

export default async function DriverHome() {
  const ctx = await getDriverContext();
  const { summary, contract, motorcycle, loans, inspection } = ctx;
  const firstName = ctx.profileName.split(" ")[0];

  if (!contract || !summary) {
    return (
      <>
        <h1 className="text-2xl font-bold">Hola, {firstName}</h1>
        <Card className="mt-4">
          <p className="text-ink-2">Todavía no tienes un contrato vigente. Cuando el administrador te asigne una moto, aquí verás tus pagos.</p>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", contract.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const activeLoans = loans.filter((l) => l.status === "active");
  const inspectionPending = Boolean(inspection?.required_this_week && !inspection.done_this_week);
  const statusTitle =
    summary.late_days === 0
      ? "¡Estás al día!"
      : `Tienes ${summary.late_days} ${summary.late_days === 1 ? "día" : "días"} de atraso`;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Hola, {firstName}</h1>
      <p className="text-sm text-ink-2">
        Moto {motorcycle?.plate} · Paga antes de las {formatTime(contract.payment_deadline)}
      </p>

      <Card className="mt-4 flex items-center gap-5">
        <TrafficLight light={summary.light} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">{statusTitle}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-3">Debes hoy</p>
          <p className="text-3xl font-bold tabular">{formatCOP(summary.due_today)}</p>
          {summary.today_kind === "rest" ? (
            <p className="mt-1 text-sm text-ok">Hoy es tu día de descanso 😎</p>
          ) : summary.today_kind === "exempt" ? (
            <p className="mt-1 text-sm text-info">Hoy no se cobra (día exento)</p>
          ) : null}
        </div>
      </Card>

      {summary.light === "red" ? (
        <div className="mt-3">
          <Alert tone="bad">
            Llevas {summary.late_days} días de atraso. Según el contrato, con {summary.max_late_days} días se devuelve la moto. Ponte al día hoy.
          </Alert>
        </div>
      ) : null}

      {summary.pending_count > 0 ? (
        <div className="mt-3">
          <Alert tone="info">
            Tienes {summary.pending_count} {summary.pending_count === 1 ? "pago" : "pagos"} en revisión por {formatCOP(summary.pending_amount)}.
          </Alert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <ButtonLink href="/conductor/pagar" size="lg" className="h-16 text-xl">
          <ReceiptText className="size-6" /> Subir pago
        </ButtonLink>
        <ButtonLink
          href="/conductor/inspeccion"
          size="lg"
          variant={inspectionPending ? "danger" : "secondary"}
          className="h-14"
        >
          {inspectionPending ? <Camera className="size-5" /> : <ClipboardCheck className="size-5" />}
          {inspectionPending ? "Inspección semanal pendiente" : "Inspección semanal ✓"}
        </ButtonLink>
        <ButtonLink href="/conductor/calendario" variant="ghost" size="md">
          <CalendarDays className="size-5" /> Ver mi calendario
        </ButtonLink>
      </div>

      {activeLoans.length ? (
        <>
          <SectionTitle>Mi préstamo</SectionTitle>
          {activeLoans.map((loan) => {
            const pct = Math.min(100, Math.round((loan.paid_amount / loan.amount) * 100));
            return (
              <Card key={loan.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{loan.concept}</p>
                  <p className="text-sm text-ink-2">Abono {formatCOP(loan.daily_installment)}/día</p>
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-ink-3">Te falta</p>
                <p className="text-2xl font-bold tabular">{formatCOP(loan.balance)}</p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  Has pagado {formatCOP(loan.paid_amount)} de {formatCOP(loan.amount)} ({pct}%)
                </p>
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionTitle action={<Link href="/conductor/calendario" className="text-sm font-medium text-ink-2">Calendario</Link>}>
        Últimos pagos
      </SectionTitle>
      {recent && recent.length ? (
        <Card className="divide-y divide-line p-0">
          {(recent as Payment[]).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold tabular">{formatCOP(p.total_amount)}</p>
                <p className="text-xs text-ink-2">
                  {formatDate(p.paid_on)} · {PAYMENT_METHOD_LABEL[p.method]}
                </p>
                {p.status === "rejected" && p.rejection_reason ? (
                  <p className="mt-0.5 text-xs text-bad">Motivo: {p.rejection_reason}</p>
                ) : null}
              </div>
              <Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>
                {PAYMENT_STATUS_LABEL[p.status]}
              </Badge>
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-2">Aún no has subido pagos.</p>
        </Card>
      )}

      {motorcycle ? (
        <Link href="/conductor/documentos" className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="font-semibold">
              {motorcycle.brand} {motorcycle.model} · {motorcycle.plate}
            </p>
            <p className="text-sm text-ink-2">{motorcycle.current_km.toLocaleString("es-CO")} km · Documentos y contrato</p>
          </div>
          <ChevronRight className="size-5 text-ink-3" />
        </Link>
      ) : null}
    </>
  );
}
