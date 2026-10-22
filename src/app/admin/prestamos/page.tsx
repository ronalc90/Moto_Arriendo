import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDate } from "@/lib/format";
import type { LoanBalance } from "@/lib/types";

export const metadata: Metadata = { title: "Préstamos" };

export default async function LoansPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: drivers }] = await Promise.all([
    supabase.from("loan_balances").select("*").order("status").order("loan_date", { ascending: false }),
    supabase.from("drivers").select("id, profiles!inner(full_name)"),
  ]);
  const names = new Map(
    ((drivers ?? []) as unknown as Array<{ id: string; profiles: { full_name: string } }>).map((d) => [d.id, d.profiles.full_name]),
  );
  const loans = (data as LoanBalance[]) ?? [];
  const active = loans.filter((l) => l.status === "active");

  return (
    <>
      <PageHeader
        title="Préstamos"
        subtitle="Dinero prestado a conductores (ej: para sacar el pase) que pagan con abonos diarios."
        action={
          <ButtonLink href="/admin/prestamos/nuevo">
            <Plus className="size-5" /> <span className="hidden sm:inline">Nuevo préstamo</span>
          </ButtonLink>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Por cobrar" value={formatCOP(active.reduce((s, l) => s + l.balance, 0))} />
        <Stat label="Préstamos activos" value={active.length} />
        <Stat label="Abonado en total" value={formatCOP(loans.reduce((s, l) => s + l.paid_amount, 0))} />
      </div>
      {loans.length ? (
        <Card className="divide-y divide-line p-0">
          {loans.map((l) => {
            const pct = Math.min(100, Math.round((l.paid_amount / l.amount) * 100));
            return (
              <Link key={l.id} href={`/admin/prestamos/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {names.get(l.driver_id)} · {l.concept}
                  </p>
                  <p className="text-xs text-ink-2">
                    {formatDate(l.loan_date)} · {formatCOP(l.amount)} · abono {formatCOP(l.daily_installment)}/día{" "}
                    {l.installment_required ? "obligatorio" : "voluntario"}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular">{formatCOP(l.balance)}</p>
                  <Badge tone={l.status === "paid" ? "ok" : "warn"}>{l.status === "paid" ? "Pagado" : `${pct}%`}</Badge>
                </div>
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="No hay préstamos." />
      )}
    </>
  );
}
