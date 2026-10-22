import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Input, SectionTitle, Textarea } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatCOP, formatDate, formatDateTime, formatPhone, formatThousands } from "@/lib/format";
import type { ContractSummary, Payment } from "@/lib/types";
import { approvePayment, rejectPayment, reopenPayment } from "../actions";

export const metadata: Metadata = { title: "Revisar pago" };

export default async function PaymentDetailPage({ params }: PageProps<"/admin/pagos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, motorcycles(plate), drivers(id, profiles(full_name, phone)), loans(concept)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const p = data as Payment & {
    motorcycles: { plate: string };
    drivers: { id: string; profiles: { full_name: string; phone: string | null } };
    loans: { concept: string } | null;
  };

  const [receiptUrl, summaryRes, reviewerRes, historyRes] = await Promise.all([
    signedUrl("receipts", p.receipt_path, 600),
    supabase.rpc("contract_summary", { p_contract_id: p.contract_id }),
    p.reviewed_by
      ? supabase.from("profiles").select("full_name").eq("id", p.reviewed_by).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("audit_log")
      .select("id, action, created_at, actor_id, details")
      .eq("table_name", "payments")
      .eq("record_id", id)
      .order("created_at"),
  ]);
  const summary = ((summaryRes.data as ContractSummary[] | null) ?? [])[0];
  const isPdf = p.receipt_path?.toLowerCase().endsWith(".pdf");
  const actorIds = [...new Set((historyRes.data ?? []).map((h) => h.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const ACTION_LABEL: Record<string, string> = {
    insert: "Creado",
    payment_approved: "Aprobado",
    payment_rejected: "Rechazado",
    payment_pending: "Devuelto a revisión",
    update: "Modificado",
  };

  return (
    <>
      <Link href="/admin/pagos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Pagos
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Receipt */}
        <Card className="p-2">
          {receiptUrl ? (
            isPdf ? (
              <div className="p-4">
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-info">
                  <ExternalLink className="size-4" /> Abrir comprobante (PDF)
                </a>
                <iframe src={receiptUrl} title="Comprobante" className="mt-3 h-[70vh] w-full rounded-xl" />
              </div>
            ) : (
              <a href={receiptUrl} target="_blank" rel="noreferrer" title="Abrir en grande">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptUrl} alt="Comprobante de pago" className="max-h-[80vh] w-full rounded-xl object-contain" />
              </a>
            )
          ) : (
            <p className="p-6 text-center text-ink-2">
              {p.method === "cash" ? "Pago en efectivo: sin comprobante." : "Sin comprobante."}
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-2">{p.drivers.profiles.full_name} · {p.motorcycles.plate}</p>
                <p className="text-3xl font-bold tabular">{formatCOP(p.total_amount)}</p>
              </div>
              <Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>
                {PAYMENT_STATUS_LABEL[p.status]}
              </Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-2">Método</dt>
              <dd>{PAYMENT_METHOD_LABEL[p.method]}</dd>
              <dt className="text-ink-2">Fecha de pago</dt>
              <dd>{formatDate(p.paid_on)}</dd>
              <dt className="text-ink-2">Enviado</dt>
              <dd>{formatDateTime(p.created_at)}</dd>
              <dt className="text-ink-2">Tarifa</dt>
              <dd className="tabular">{formatCOP(p.rate_amount)}</dd>
              <dt className="text-ink-2">Abono</dt>
              <dd className="tabular">
                {formatCOP(p.installment_amount)} {p.loans ? `(${p.loans.concept})` : ""}
              </dd>
              <dt className="text-ink-2">Celular</dt>
              <dd>{formatPhone(p.drivers.profiles.phone)}</dd>
              {p.reviewed_at ? (
                <>
                  <dt className="text-ink-2">Revisado</dt>
                  <dd>
                    {reviewerRes.data?.full_name ?? "—"} · {formatDateTime(p.reviewed_at)}
                  </dd>
                </>
              ) : null}
              {p.rejection_reason ? (
                <>
                  <dt className="text-ink-2">Motivo</dt>
                  <dd className="text-bad">{p.rejection_reason}</dd>
                </>
              ) : null}
              {p.notes ? (
                <>
                  <dt className="text-ink-2">Notas</dt>
                  <dd>{p.notes}</dd>
                </>
              ) : null}
            </dl>
          </Card>

          {summary ? (
            <Card>
              <div className="flex items-center justify-between">
                <p className="font-semibold">Situación del conductor</p>
                <LightBadge light={summary.light} lateDays={summary.late_days} />
              </div>
              <p className="mt-2 text-sm text-ink-2">
                Debe {formatCOP(summary.total_debt)} (sin contar este pago si está en revisión) · préstamo{" "}
                {formatCOP(summary.loan_balance)}
              </p>
              <Link href={`/admin/conductores/${p.drivers.id}`} className="mt-2 inline-block text-sm font-semibold text-info">
                Ver ficha del conductor
              </Link>
            </Card>
          ) : null}

          {p.status === "pending" ? (
            <>
              <Card>
                <p className="mb-3 font-semibold">Aprobar</p>
                <ActionForm action={approvePayment} submitLabel="Aprobar pago" submitVariant="success" pendingLabel="Aprobando…">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="A tarifa" htmlFor="rate_amount">
                      <Input id="rate_amount" name="rate_amount" inputMode="numeric" defaultValue={formatThousands(p.rate_amount)} />
                    </Field>
                    <Field label="A préstamo" htmlFor="installment_amount">
                      <Input
                        id="installment_amount"
                        name="installment_amount"
                        inputMode="numeric"
                        defaultValue={formatThousands(p.installment_amount)}
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-ink-3">Puedes ajustar el reparto; la suma debe ser {formatCOP(p.total_amount)}.</p>
                </ActionForm>
              </Card>
              <Card>
                <p className="mb-3 font-semibold">Rechazar</p>
                <ActionForm action={rejectPayment} submitLabel="Rechazar pago" submitVariant="danger" pendingLabel="Rechazando…">
                  <input type="hidden" name="id" value={p.id} />
                  <Field label="Motivo (lo verá el conductor)" htmlFor="reason">
                    <Textarea id="reason" name="reason" required placeholder="Ej: el comprobante no se ve / el valor no coincide" />
                  </Field>
                </ActionForm>
              </Card>
            </>
          ) : (
            <Card>
              <p className="mb-3 text-sm text-ink-2">
                {p.status === "approved"
                  ? "¿Te equivocaste? Puedes anular este pago con un motivo o devolverlo a revisión."
                  : "Puedes devolver este pago a revisión si el conductor lo corrigió."}
              </p>
              <ActionForm action={reopenPayment} submitLabel="Devolver a revisión" submitVariant="secondary" submitSize="md">
                <input type="hidden" name="id" value={p.id} />
              </ActionForm>
              {p.status === "approved" ? (
                <div className="mt-4 border-t border-line pt-4">
                  <ActionForm action={rejectPayment} submitLabel="Anular pago" submitVariant="danger" submitSize="md">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="Motivo de la anulación" htmlFor="reason">
                      <Input id="reason" name="reason" required />
                    </Field>
                  </ActionForm>
                </div>
              ) : null}
            </Card>
          )}

          {historyRes.data?.length ? (
            <>
              <SectionTitle>Historial</SectionTitle>
              <Card className="space-y-2 text-sm">
                {historyRes.data.map((h) => (
                  <p key={h.id}>
                    <span className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</span>{" "}
                    <span className="text-ink-2">
                      · {h.actor_id ? actorName.get(h.actor_id) ?? "Usuario" : "Sistema"} · {formatDateTime(h.created_at)}
                    </span>
                  </p>
                ))}
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
