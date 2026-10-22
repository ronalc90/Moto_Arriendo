import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileCheck2, FileX2, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS_SHORT, formatCOP, formatDate } from "@/lib/format";
import type { ContractOverview } from "@/lib/types";

export const metadata: Metadata = { title: "Contratos" };

export default async function ContractsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: files }] = await Promise.all([
    supabase.from("contract_overview").select("*").order("start_date", { ascending: false }),
    supabase.from("contracts").select("id, file_path"),
  ]);
  const hasFile = new Map((files ?? []).map((f) => [f.id, Boolean(f.file_path)]));
  const rows = (data as ContractOverview[]) ?? [];
  const active = rows.filter((r) => r.status === "active");
  const ended = rows.filter((r) => r.status === "ended");

  const row = (c: ContractOverview) => (
    <Link key={c.id} href={`/admin/contratos/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
      {hasFile.get(c.id) ? (
        <FileCheck2 className="size-5 shrink-0 text-ok" aria-label="Con PDF firmado" />
      ) : (
        <FileX2 className="size-5 shrink-0 text-warn" aria-label="Sin PDF firmado" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {c.driver_name} · {c.plate}
        </p>
        <p className="text-xs text-ink-2">
          {formatCOP(c.daily_rate)}/día · desde {formatDate(c.start_date)}
          {c.end_date ? ` hasta ${formatDate(c.end_date)}` : ""} · descanso{" "}
          {c.rest_weekdays.map((d) => WEEKDAYS_SHORT[d]).join(", ") || "ninguno"}
        </p>
      </div>
      {c.status === "active" ? <LightBadge light={c.light} lateDays={c.late_days} /> : <Badge>Terminado</Badge>}
      <ChevronRight className="size-5 text-ink-3" />
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle={`${active.length} vigentes`}
        action={
          <ButtonLink href="/admin/contratos/nuevo">
            <Plus className="size-5" /> <span className="hidden sm:inline">Nuevo contrato</span>
          </ButtonLink>
        }
      />
      {active.length ? <Card className="divide-y divide-line p-0">{active.map(row)}</Card> : <EmptyState title="No hay contratos vigentes." />}
      {ended.length ? (
        <>
          <SectionTitle>Terminados</SectionTitle>
          <Card className="divide-y divide-line p-0">{ended.map(row)}</Card>
        </>
      ) : null}
    </>
  );
}
