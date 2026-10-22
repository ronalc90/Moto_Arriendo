import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatPhone } from "@/lib/format";
import type { ContractOverview } from "@/lib/types";

export const metadata: Metadata = { title: "Conductores" };

type Row = {
  id: string;
  status: "active" | "inactive";
  national_id: string;
  profiles: { full_name: string; phone: string | null; data_consent_at: string | null };
};

export default async function DriversPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: overview }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, status, national_id, profiles!inner(full_name, phone, data_consent_at)")
      .order("status")
      .order("created_at"),
    supabase.from("contract_overview").select("*").eq("status", "active"),
  ]);
  const byDriver = new Map(((overview as ContractOverview[]) ?? []).map((o) => [o.driver_id, o]));
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader
        title="Conductores"
        subtitle={`${rows.filter((r) => r.status === "active").length} activos`}
        action={
          <ButtonLink href="/admin/conductores/nuevo">
            <Plus className="size-5" /> <span className="hidden sm:inline">Nuevo conductor</span>
          </ButtonLink>
        }
      />
      {rows.length ? (
        <Card className="divide-y divide-line p-0">
          {rows.map((d) => {
            const o = byDriver.get(d.id);
            return (
              <Link key={d.id} href={`/admin/conductores/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {d.profiles.full_name}
                    {d.status === "inactive" ? <span className="ml-2 text-xs font-normal text-ink-3">(inactivo)</span> : null}
                  </p>
                  <p className="text-xs text-ink-2">
                    {formatPhone(d.profiles.phone)} · CC {d.national_id}
                    {o ? ` · ${o.plate}` : " · sin moto"}
                    {!d.profiles.data_consent_at ? " · no ha entrado" : ""}
                  </p>
                </div>
                {o ? (
                  <div className="text-right">
                    <LightBadge light={o.light} lateDays={o.late_days} />
                    {o.total_debt ? <p className="mt-1 text-xs font-semibold tabular">Debe {formatCOP(o.total_debt)}</p> : null}
                  </div>
                ) : d.status === "active" ? (
                  <Badge>Sin contrato</Badge>
                ) : null}
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="Aún no hay conductores.">
          <Link href="/admin/conductores/nuevo" className="font-semibold text-info">
            Crear el primero
          </Link>
        </EmptyState>
      )}
    </>
  );
}
