import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { OwnerFilter } from "@/components/owner-filter";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOwners } from "@/lib/admin";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Pagos" };

const TABS = [
  { value: "pending", label: "Por revisar" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
];

type Row = {
  id: string;
  total_amount: number;
  rate_amount: number;
  installment_amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  paid_on: string;
  created_at: string;
  rejection_reason: string | null;
  motorcycles: { plate: string; owner_id: string };
  drivers: { profiles: { full_name: string } };
};

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/pagos">) {
  await requireAdmin();
  const params = await searchParams;
  const status = TABS.some((t) => t.value === params.estado) ? String(params.estado) : "pending";
  const owner = typeof params.propietario === "string" ? params.propietario : "";
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select(
      "id, total_amount, rate_amount, installment_amount, method, status, paid_on, created_at, rejection_reason, motorcycles!inner(plate, owner_id), drivers!inner(profiles!inner(full_name))",
    )
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "paid_on", { ascending: status === "pending" })
    .limit(200);
  if (owner) query = query.eq("motorcycles.owner_id", owner);

  const [{ data }, owners] = await Promise.all([query, getOwners()]);
  const rows = (data as unknown as Row[]) ?? [];
  const total = rows.reduce((s, r) => s + r.total_amount, 0);

  return (
    <>
      <PageHeader
        title="Pagos"
        subtitle={`${rows.length} ${rows.length === 1 ? "pago" : "pagos"} · ${formatCOP(total)}`}
        action={
          <ButtonLink href="/admin/pagos/nuevo" size="md">
            <Plus className="size-5" /> <span className="hidden sm:inline">Registrar pago</span>
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/admin/pagos?estado=${t.value}${owner ? `&propietario=${owner}` : ""}`}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                status === t.value ? "bg-brand text-brand-ink" : "text-ink-2",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {owners.length > 1 ? <OwnerFilter owners={owners} value={owner} /> : null}
      </div>

      {rows.length ? (
        <Card className="divide-y divide-line p-0">
          {rows.map((p) => (
            <Link key={p.id} href={`/admin/pagos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.drivers.profiles.full_name}</p>
                <p className="text-xs text-ink-2">
                  {p.motorcycles.plate} · {PAYMENT_METHOD_LABEL[p.method]} · {formatDate(p.paid_on)}
                  {status === "pending" ? ` · enviado ${formatDateTime(p.created_at)}` : ""}
                </p>
                {p.installment_amount ? (
                  <p className="text-xs text-ink-3">
                    Tarifa {formatCOP(p.rate_amount)} + abono {formatCOP(p.installment_amount)}
                  </p>
                ) : null}
                {p.rejection_reason ? <p className="text-xs text-bad">{p.rejection_reason}</p> : null}
              </div>
              <div className="text-right">
                <p className="font-bold tabular">{formatCOP(p.total_amount)}</p>
                <Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>
                  {PAYMENT_STATUS_LABEL[p.status]}
                </Badge>
              </div>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title={status === "pending" ? "No hay pagos por revisar ✓" : "No hay pagos aquí."} />
      )}
    </>
  );
}
