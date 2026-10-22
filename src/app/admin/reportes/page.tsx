import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { MonthlyBars, PaybackLine } from "@/components/charts";
import { OwnerFilter } from "@/components/owner-filter";
import { Card, EmptyState, PageHeader, SectionTitle, Stat, buttonClass, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOwners } from "@/lib/admin";
import { MONTHS, formatCOP } from "@/lib/format";

export const metadata: Metadata = { title: "Reportes" };

type Monthly = {
  motorcycle_id: string;
  plate: string;
  owner_id: string;
  month: string;
  income: number;
  installments: number;
  costs: number;
  net: number;
};
type Payback = {
  motorcycle_id: string;
  plate: string;
  owner_id: string;
  purchase_price: number | null;
  income: number;
  costs: number;
  net: number;
  recovered_pct: number | null;
  remaining: number;
};

const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(2, 4)}`;

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reportes">) {
  await requireAdmin();
  const sp = await searchParams;
  const owner = typeof sp.propietario === "string" ? sp.propietario : "";
  const moto = typeof sp.moto === "string" ? sp.moto : "";
  const supabase = await createClient();
  const [{ data: monthlyData }, { data: paybackData }, owners] = await Promise.all([
    supabase.from("finance_monthly").select("*").order("month"),
    supabase.from("motorcycle_payback").select("*").order("plate"),
    getOwners(),
  ]);
  const ownerName = new Map(owners.map((o) => [o.value, o.label]));
  let paybacks = (paybackData as Payback[]) ?? [];
  if (owner) paybacks = paybacks.filter((p) => p.owner_id === owner);
  const selected = moto ? paybacks.filter((p) => p.motorcycle_id === moto) : paybacks;
  const ids = new Set(selected.map((p) => p.motorcycle_id));
  const monthly = ((monthlyData as Monthly[]) ?? []).filter((m) => ids.has(m.motorcycle_id));

  // Aggregate by month for the selection
  const byMonth = new Map<string, { income: number; costs: number; installments: number }>();
  for (const m of monthly) {
    const cur = byMonth.get(m.month) ?? { income: 0, costs: 0, installments: 0 };
    cur.income += Number(m.income);
    cur.costs += Number(m.costs);
    cur.installments += Number(m.installments);
    byMonth.set(m.month, cur);
  }
  const months = [...byMonth.keys()].sort();
  const last12 = months.slice(-12);
  const cumulativeSeries = months.reduce<{ label: string; value: number }[]>((acc, m) => {
    const v = byMonth.get(m)!;
    const prev = acc.length ? acc[acc.length - 1].value : 0;
    acc.push({ label: monthLabel(m), value: prev + v.income - v.costs });
    return acc;
  }, []);
  const investment = selected.reduce((s, p) => s + (p.purchase_price ?? 0), 0);
  const totals = selected.reduce(
    (acc, p) => ({ income: acc.income + Number(p.income), costs: acc.costs + Number(p.costs), net: acc.net + Number(p.net) }),
    { income: 0, costs: 0, net: 0 },
  );
  const query = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(owner ? { propietario: owner } : {}), ...extra });
    return q.toString() ? `?${q}` : "";
  };

  return (
    <>
      <PageHeader
        title="Reportes financieros"
        subtitle="Ingresos = tarifas aprobadas. Gastos = lo que paga el propietario. Los abonos a préstamos no cuentan como ingreso."
        action={owners.length > 1 ? <OwnerFilter owners={owners} value={owner} /> : null}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/reportes${query({})}`}
          className={cx("rounded-xl border px-3 py-1.5 text-sm font-medium", !moto ? "border-brand-strong bg-brand text-brand-ink" : "border-line bg-surface text-ink-2")}
        >
          Todas
        </Link>
        {paybacks.map((p) => (
          <Link
            key={p.motorcycle_id}
            href={`/admin/reportes${query({ moto: p.motorcycle_id })}`}
            className={cx(
              "rounded-xl border px-3 py-1.5 text-sm font-medium",
              moto === p.motorcycle_id ? "border-brand-strong bg-brand text-brand-ink" : "border-line bg-surface text-ink-2",
            )}
          >
            {p.plate}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ingresos" value={formatCOP(totals.income)} />
        <Stat label="Gastos" value={formatCOP(totals.costs)} />
        <Stat label="Ganancia neta" value={formatCOP(totals.net)} tone={totals.net >= 0 ? "ok" : "bad"} />
        <Stat label="Inversión" value={formatCOP(investment)} hint={investment ? `recuperado ${Math.round((totals.net / investment) * 100)}%` : undefined} />
      </div>

      <SectionTitle>¿Cuánto le falta a cada moto para recuperar la inversión?</SectionTitle>
      {selected.length ? (
        <Card className="space-y-5">
          {selected.map((p) => {
            const pct = p.purchase_price ? Math.max(0, Math.min(100, (Number(p.net) / p.purchase_price) * 100)) : 0;
            return (
              <div key={p.motorcycle_id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {p.plate} <span className="text-sm font-normal text-ink-2">· {ownerName.get(p.owner_id)}</span>
                  </p>
                  <p className="text-sm">
                    {p.purchase_price ? (
                      p.remaining > 0 ? (
                        <>
                          Le faltan <strong className="tabular">{formatCOP(p.remaining)}</strong>
                        </>
                      ) : (
                        <strong className="text-ok">¡Inversión recuperada!</strong>
                      )
                    ) : (
                      <span className="text-ink-3">Registra el valor de compra</span>
                    )}
                  </p>
                </div>
                <div
                  className="mt-2 h-4 overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Recuperación ${p.plate}`}
                >
                  <div className="h-full rounded-full bg-series-1" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  Neto {formatCOP(Number(p.net))} de {formatCOP(p.purchase_price ?? 0)} · {Math.round(pct)}%
                </p>
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="No hay motos." />
      )}

      {months.length ? (
        <>
          <SectionTitle>Recuperación acumulada</SectionTitle>
          <Card>
            <PaybackLine data={cumulativeSeries} target={investment} />
          </Card>

          <SectionTitle>Ingresos y gastos por mes</SectionTitle>
          <Card>
            <MonthlyBars data={last12.map((m) => ({ label: monthLabel(m), ...byMonth.get(m)! }))} />
          </Card>

          <SectionTitle
            action={
              <div className="flex gap-2">
                <a href={`/api/exportar?tipo=pagos${moto ? `&moto=${moto}` : ""}`} className={buttonClass("secondary", "sm")}>
                  <Download className="size-4" /> Pagos
                </a>
                <a href={`/api/exportar?tipo=gastos${moto ? `&moto=${moto}` : ""}`} className={buttonClass("secondary", "sm")}>
                  <Download className="size-4" /> Gastos
                </a>
              </div>
            }
          >
            Detalle por mes
          </SectionTitle>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5">Mes</th>
                  <th className="px-4 py-2.5 text-right">Ingresos</th>
                  <th className="px-4 py-2.5 text-right">Abonos préstamos</th>
                  <th className="px-4 py-2.5 text-right">Gastos</th>
                  <th className="px-4 py-2.5 text-right">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular">
                {[...months].reverse().map((m) => {
                  const v = byMonth.get(m)!;
                  const net = v.income - v.costs;
                  return (
                    <tr key={m}>
                      <td className="px-4 py-2.5 font-medium capitalize">{MONTHS[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCOP(v.income)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCOP(v.installments)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCOP(v.costs)}</td>
                      <td className={cx("px-4 py-2.5 text-right font-semibold", net < 0 && "text-bad")}>{formatCOP(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState title="Aún no hay movimientos para graficar." />
        </div>
      )}
    </>
  );
}
