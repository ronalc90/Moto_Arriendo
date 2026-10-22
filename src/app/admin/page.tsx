import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { OwnerFilter } from "@/components/owner-filter";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentMonth, getOwners } from "@/lib/admin";
import { DOC_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { MONTHS, WEEKDAYS, formatCOP, formatDate, formatDateTime, weekday } from "@/lib/format";
import type { ContractOverview, Expiration } from "@/lib/types";

export const metadata: Metadata = { title: "Hoy" };

type PendingPayment = {
  id: string;
  total_amount: number;
  method: string;
  paid_on: string;
  created_at: string;
  motorcycles: { plate: string; owner_id: string };
  drivers: { profiles: { full_name: string } };
};

export default async function AdminTodayPage({ searchParams }: PageProps<"/admin">) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const owner = typeof params.propietario === "string" ? params.propietario : "";
  const supabase = await createClient();
  const { today, month, from, to } = currentMonth();

  const [overviewRes, pendingRes, expRes, inspRes, damagesRes, incomeRes, owners] = await Promise.all([
    supabase.from("contract_overview").select("*").eq("status", "active"),
    supabase
      .from("payments")
      .select("id, total_amount, method, paid_on, created_at, motorcycles!inner(plate, owner_id), drivers!inner(profiles!inner(full_name))")
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("document_expirations").select("*").lte("days_left", 30).order("days_left"),
    supabase.from("inspection_status").select("*").eq("required_this_week", true).eq("done_this_week", false),
    supabase.from("damage_reports").select("id", { count: "exact", head: true }).neq("status", "closed"),
    supabase
      .from("payments")
      .select("rate_amount, installment_amount, total_amount, motorcycle_id, motorcycles!inner(plate, owner_id)")
      .eq("status", "approved")
      .gte("paid_on", from)
      .lte("paid_on", to),
    getOwners(),
  ]);

  let overview = (overviewRes.data as ContractOverview[]) ?? [];
  let pending = (pendingRes.data as unknown as PendingPayment[]) ?? [];
  let expirations = (expRes.data as Expiration[]) ?? [];
  if (owner) {
    overview = overview.filter((o) => o.owner_id === owner);
    pending = pending.filter((p) => p.motorcycles.owner_id === owner);
  }
  const motoOwner = new Map(overview.map((o) => [o.motorcycle_id, o.owner_id]));
  if (owner) expirations = expirations.filter((e) => !e.motorcycle_id || motoOwner.get(e.motorcycle_id) === owner);

  const late = [...overview].sort((a, b) => b.late_days - a.late_days || b.total_debt - a.total_debt);
  const lateCount = overview.filter((o) => o.late_days > 0).length;
  const byContractDriver = new Map(overview.map((o) => [o.driver_id, o]));
  const pendingInspections = (inspRes.data ?? []).filter((i) => !owner || motoOwner.get(i.motorcycle_id) === owner);

  // Income this month by motorcycle and by owner
  type IncomeRow = { rate_amount: number; installment_amount: number; total_amount: number; motorcycle_id: string; motorcycles: { plate: string; owner_id: string } };
  const ownerName = new Map(owners.map((o) => [o.value, o.label]));
  const perMoto = new Map<string, { plate: string; owner: string; rate: number; inst: number }>();
  for (const r of ((incomeRes.data as unknown as IncomeRow[]) ?? [])) {
    if (owner && r.motorcycles.owner_id !== owner) continue;
    const cur = perMoto.get(r.motorcycle_id) ?? { plate: r.motorcycles.plate, owner: r.motorcycles.owner_id, rate: 0, inst: 0 };
    cur.rate += r.rate_amount;
    cur.inst += r.installment_amount;
    perMoto.set(r.motorcycle_id, cur);
  }
  const perOwner = new Map<string, { rate: number; inst: number }>();
  for (const m of perMoto.values()) {
    const cur = perOwner.get(m.owner) ?? { rate: 0, inst: 0 };
    cur.rate += m.rate;
    cur.inst += m.inst;
    perOwner.set(m.owner, cur);
  }
  const monthRate = [...perMoto.values()].reduce((s, m) => s + m.rate, 0);
  const monthInst = [...perMoto.values()].reduce((s, m) => s + m.inst, 0);
  const [, mm] = month.split("-").map(Number);

  return (
    <>
      <PageHeader
        title={`Hola, ${profile.full_name.split(" ")[0]}`}
        subtitle={`${WEEKDAYS[weekday(today)]} ${formatDate(today)}`}
        action={owners.length > 1 ? <OwnerFilter owners={owners} value={owner} /> : null}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/pagos">
          <Stat
            label="Pagos por revisar"
            value={pending.length}
            hint={pending.length ? formatCOP(pending.reduce((s, p) => s + p.total_amount, 0)) : "Todo revisado"}
            tone={pending.length ? "warn" : "ok"}
          />
        </Link>
        <Stat label="Con atraso" value={`${lateCount} de ${overview.length}`} tone={lateCount ? "bad" : "ok"} hint="conductores" />
        <Stat label="Por vencer (30 días)" value={expirations.length} tone={expirations.length ? "warn" : "ok"} hint="documentos" />
        <Link href="/admin/inspecciones">
          <Stat
            label="Inspecciones pendientes"
            value={pendingInspections.length}
            tone={pendingInspections.length ? "warn" : "ok"}
            hint={damagesRes.count ? `${damagesRes.count} daños abiertos` : "esta semana"}
          />
        </Link>
      </div>

      <SectionTitle action={<Link href="/admin/pagos" className="text-sm font-medium text-ink-2">Ver todos</Link>}>
        Pagos por revisar
      </SectionTitle>
      {pending.length ? (
        <Card className="divide-y divide-line p-0">
          {pending.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/admin/pagos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.drivers.profiles.full_name}</p>
                <p className="text-xs text-ink-2">
                  {p.motorcycles.plate} · {PAYMENT_METHOD_LABEL[p.method]} · enviado {formatDateTime(p.created_at)}
                </p>
              </div>
              <p className="font-bold tabular">{formatCOP(p.total_amount)}</p>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="No hay pagos por revisar ✓" />
      )}

      <SectionTitle action={<Link href="/admin/conductores" className="text-sm font-medium text-ink-2">Conductores</Link>}>
        Estado de los conductores
      </SectionTitle>
      {late.length ? (
        <Card className="divide-y divide-line p-0">
          {late.map((o) => (
            <Link key={o.id} href={`/admin/conductores/${o.driver_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{o.driver_name}</p>
                <p className="text-xs text-ink-2">
                  {o.plate}
                  {o.pending_count ? ` · ${o.pending_count} pago(s) en revisión` : ""}
                  {o.loan_balance ? ` · préstamo ${formatCOP(o.loan_balance)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <LightBadge light={o.light} lateDays={o.late_days} />
                <p className="mt-1 text-sm font-semibold tabular">{o.total_debt ? `Debe ${formatCOP(o.total_debt)}` : "Al día"}</p>
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="No hay contratos vigentes">
          <Link href="/admin/contratos/nuevo" className="font-semibold text-info">Crear un contrato</Link>
        </EmptyState>
      )}

      <SectionTitle>Documentos por vencer</SectionTitle>
      {expirations.length ? (
        <Card className="divide-y divide-line p-0">
          {expirations.map((e, i) => (
            <Link
              key={`${e.document_id ?? e.doc_type}-${e.motorcycle_id ?? e.driver_id}-${i}`}
              href={e.motorcycle_id ? `/admin/motos/${e.motorcycle_id}` : `/admin/conductores/${e.driver_id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {DOC_TYPE_LABEL[e.doc_type]} · {e.plate ?? e.driver_name}
                </p>
                <p className="text-xs text-ink-2">Vence el {formatDate(e.expires_on)}</p>
              </div>
              <Badge tone={e.days_left <= 7 ? "bad" : "warn"}>
                {e.days_left < 0 ? "Vencido" : e.days_left === 0 ? "Vence hoy" : `${e.days_left} días`}
              </Badge>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="Nada vence en los próximos 30 días ✓" />
      )}

      <SectionTitle action={<Link href="/admin/inspecciones" className="text-sm font-medium text-ink-2">Ver</Link>}>
        Inspecciones pendientes de esta semana
      </SectionTitle>
      {pendingInspections.length ? (
        <Card className="divide-y divide-line p-0">
          {pendingInspections.map((i) => {
            const o = byContractDriver.get(i.driver_id);
            return (
              <div key={i.contract_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold">{o?.driver_name ?? "Conductor"}</p>
                  <p className="text-xs text-ink-2">
                    {o?.plate} · última: {i.last_inspection_on ? formatDate(i.last_inspection_on) : "nunca"}
                  </p>
                </div>
                <Badge tone="warn">Pendiente</Badge>
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="Todas las inspecciones de la semana están al día ✓" />
      )}

      <SectionTitle action={<Link href="/admin/reportes" className="text-sm font-medium text-ink-2">Reportes</Link>}>
        Ingresos de {MONTHS[mm - 1]}
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Tarifas cobradas" value={formatCOP(monthRate)} />
        <Stat label="Abonos a préstamos" value={formatCOP(monthInst)} />
        <Stat label="Total recibido" value={formatCOP(monthRate + monthInst)} />
      </div>
      {perMoto.size ? (
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5">Moto</th>
                <th className="px-4 py-2.5">Propietario</th>
                <th className="px-4 py-2.5 text-right">Tarifas</th>
                <th className="px-4 py-2.5 text-right">Abonos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...perMoto.values()].map((m) => (
                <tr key={m.plate}>
                  <td className="px-4 py-2.5 font-semibold">{m.plate}</td>
                  <td className="px-4 py-2.5">{ownerName.get(m.owner) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatCOP(m.rate)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatCOP(m.inst)}</td>
                </tr>
              ))}
              {perOwner.size > 1
                ? [...perOwner.entries()].map(([id, v]) => (
                    <tr key={id} className="bg-surface-2/60 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5">{ownerName.get(id)}</td>
                      <td className="px-4 py-2.5 text-right tabular">{formatCOP(v.rate)}</td>
                      <td className="px-4 py-2.5 text-right tabular">{formatCOP(v.inst)}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </Card>
      ) : null}
    </>
  );
}
