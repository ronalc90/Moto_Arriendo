import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Collapsible } from "@/components/collapsible";
import { Badge, ButtonLink, Card, EmptyState, Field, Input, PageHeader, SectionTitle, Stat, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatCOP, formatDate, formatThousands } from "@/lib/format";
import type { LoanBalance, Payment } from "@/lib/types";
import { updateLoan } from "../actions";

export const metadata: Metadata = { title: "Préstamo" };

export default async function LoanDetailPage({ params }: PageProps<"/admin/prestamos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("loan_balances").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const loan = data as LoanBalance;
  const [{ data: driver }, { data: payments }, { data: contract }] = await Promise.all([
    supabase.from("drivers").select("id, profiles!inner(full_name)").eq("id", loan.driver_id).single(),
    supabase.from("payments").select("*").eq("loan_id", id).order("paid_on", { ascending: false }),
    supabase.from("contracts").select("id").eq("driver_id", loan.driver_id).eq("status", "active").maybeSingle(),
  ]);
  const name = (driver as unknown as { profiles: { full_name: string } } | null)?.profiles.full_name ?? "";
  const pct = Math.min(100, Math.round((loan.paid_amount / loan.amount) * 100));

  return (
    <>
      <Link href="/admin/prestamos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Préstamos
      </Link>
      <PageHeader
        title={`${loan.concept} · ${name}`}
        subtitle={`Desde ${formatDate(loan.loan_date)} · abono ${formatCOP(loan.daily_installment)}/día ${loan.installment_required ? "(obligatorio)" : "(voluntario)"}`}
        action={<Badge tone={loan.status === "paid" ? "ok" : "warn"}>{loan.status === "paid" ? "Pagado" : "Activo"}</Badge>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Prestado" value={formatCOP(loan.amount)} />
        <Stat label="Abonado" value={formatCOP(loan.paid_amount)} hint={`${pct}%`} />
        <Stat label="Saldo" value={formatCOP(loan.balance)} tone={loan.balance > 0 ? "warn" : "ok"} />
        <Stat label="En revisión" value={formatCOP(loan.pending_amount)} />
      </div>
      {contract && loan.status === "active" ? (
        <div className="mt-4">
          <ButtonLink href={`/admin/pagos/nuevo?contrato=${contract.id}&tipo=abono`} variant="secondary" size="md">
            <Plus className="size-4" /> Registrar abono extra
          </ButtonLink>
        </div>
      ) : null}

      <SectionTitle>Abonos</SectionTitle>
      {payments?.length ? (
        <Card className="divide-y divide-line p-0">
          {(payments as Payment[]).map((p) => (
            <Link key={p.id} href={`/admin/pagos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold tabular">{formatCOP(p.installment_amount)}</p>
                <p className="text-xs text-ink-2">
                  {formatDate(p.paid_on)} · pago total {formatCOP(p.total_amount)}
                </p>
              </div>
              <Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>
                {PAYMENT_STATUS_LABEL[p.status]}
              </Badge>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="Aún no hay abonos." />
      )}

      <div className="mt-6">
        <Collapsible title="Editar préstamo">
          <ActionForm action={updateLoan} submitLabel="Guardar" submitSize="md">
            <input type="hidden" name="id" value={id} />
            <Field label="Concepto" htmlFor="concept">
              <Input id="concept" name="concept" defaultValue={loan.concept} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto" htmlFor="amount">
                <Input id="amount" name="amount" inputMode="numeric" defaultValue={formatThousands(loan.amount)} />
              </Field>
              <Field label="Abono diario" htmlFor="daily_installment">
                <Input id="daily_installment" name="daily_installment" inputMode="numeric" defaultValue={formatThousands(loan.daily_installment)} />
              </Field>
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="installment_required" defaultChecked={loan.installment_required} className="size-5 accent-[var(--brand-strong)]" />
              <span className="text-sm">Abono obligatorio (afecta el semáforo)</span>
            </label>
            <Field label="Notas" htmlFor="notes">
              <Textarea id="notes" name="notes" defaultValue={loan.notes ?? ""} />
            </Field>
          </ActionForm>
        </Collapsible>
      </div>
    </>
  );
}
