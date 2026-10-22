import type { Metadata } from "next";
import Link from "next/link";
import { Bike, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { OwnerFilter } from "@/components/owner-filter";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOwners } from "@/lib/admin";
import { MOTORCYCLE_STATUS_LABEL } from "@/lib/constants";
import type { ContractOverview, Expiration, Motorcycle } from "@/lib/types";

export const metadata: Metadata = { title: "Motos" };

export default async function MotorcyclesPage({ searchParams }: PageProps<"/admin/motos">) {
  await requireAdmin();
  const params = await searchParams;
  const owner = typeof params.propietario === "string" ? params.propietario : "";
  const supabase = await createClient();
  let q = supabase.from("motorcycles").select("*").order("plate");
  if (owner) q = q.eq("owner_id", owner);
  const [{ data: motos }, { data: contracts }, { data: exp }, owners] = await Promise.all([
    q,
    supabase.from("contract_overview").select("*").eq("status", "active"),
    supabase.from("document_expirations").select("*").lte("days_left", 30),
    getOwners(),
  ]);
  const byMoto = new Map(((contracts as ContractOverview[]) ?? []).map((c) => [c.motorcycle_id, c]));
  const ownerName = new Map(owners.map((o) => [o.value, o.label]));
  const alerts = new Map<string, number>();
  for (const e of (exp as Expiration[]) ?? []) {
    if (e.motorcycle_id) alerts.set(e.motorcycle_id, (alerts.get(e.motorcycle_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Motos"
        subtitle={`${motos?.length ?? 0} registradas`}
        action={
          <div className="flex items-center gap-2">
            {owners.length > 1 ? <OwnerFilter owners={owners} value={owner} /> : null}
            <ButtonLink href="/admin/motos/nueva">
              <Plus className="size-5" /> <span className="hidden sm:inline">Nueva moto</span>
            </ButtonLink>
          </div>
        }
      />
      {motos?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(motos as Motorcycle[]).map((m) => {
            const c = byMoto.get(m.id);
            return (
              <Link key={m.id} href={`/admin/motos/${m.id}`}>
                <Card className="h-full transition-colors hover:border-brand-strong">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-asphalt text-brand">
                        <Bike className="size-6" />
                      </span>
                      <div>
                        <p className="text-lg font-bold tracking-wide">{m.plate}</p>
                        <p className="text-xs text-ink-2">
                          {m.brand} {m.model} · {ownerName.get(m.owner_id)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={m.status === "active" ? "ok" : m.status === "inactive" ? "neutral" : "warn"}>
                      {MOTORCYCLE_STATUS_LABEL[m.status]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    {c ? (
                      <>
                        <span className="font-medium">{c.driver_name}</span>
                        <LightBadge light={c.light} lateDays={c.late_days} />
                      </>
                    ) : (
                      <span className="text-ink-3">Sin conductor</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-2">
                    {m.current_km.toLocaleString("es-CO")} km
                    {alerts.get(m.id) ? <span className="ml-2 font-semibold text-warn">⚠ {alerts.get(m.id)} documento(s) por vencer</span> : null}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Aún no hay motos registradas.">
          <Link href="/admin/motos/nueva" className="font-semibold text-info">Registrar la primera</Link>
        </EmptyState>
      )}
    </>
  );
}
