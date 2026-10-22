import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, formatDate } from "@/lib/format";
import type { ContractOverview, Inspection } from "@/lib/types";

export const metadata: Metadata = { title: "Inspecciones" };

export default async function InspectionsPage({ searchParams }: PageProps<"/admin/inspecciones">) {
  await requireAdmin();
  const sp = await searchParams;
  const moto = typeof sp.moto === "string" ? sp.moto : "";
  const supabase = await createClient();
  let q = supabase
    .from("inspections")
    .select("*, motorcycles(plate), drivers(profiles(full_name))")
    .order("inspected_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (moto) q = q.eq("motorcycle_id", moto);
  const [{ data }, { data: status }, { data: overview }, { data: settings }] = await Promise.all([
    q,
    supabase.from("inspection_status").select("*"),
    supabase.from("contract_overview").select("id, driver_name, plate").eq("status", "active"),
    supabase.from("settings").select("inspection_weekday").eq("id", 1).single(),
  ]);
  const names = new Map(((overview as Pick<ContractOverview, "id" | "driver_name" | "plate">[]) ?? []).map((o) => [o.id, o]));
  const pending = (status ?? []).filter((s) => s.required_this_week && !s.done_this_week);
  const rows = (data as Array<Inspection & { motorcycles: { plate: string }; drivers: { profiles: { full_name: string } } }>) ?? [];

  return (
    <>
      <PageHeader
        title="Inspecciones"
        subtitle={`Cada conductor sube una por semana (día: ${WEEKDAYS[settings?.inspection_weekday ?? 1].toLowerCase()}).`}
      />
      {!moto ? (
        <>
          <SectionTitle>Pendientes esta semana</SectionTitle>
          {pending.length ? (
            <Card className="divide-y divide-line p-0">
              {pending.map((p) => {
                const o = names.get(p.contract_id);
                return (
                  <div key={p.contract_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold">{o?.driver_name}</p>
                      <p className="text-xs text-ink-2">
                        {o?.plate} · última: {p.last_inspection_on ? formatDate(p.last_inspection_on) : "nunca"}
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
        </>
      ) : null}

      <SectionTitle>Recibidas</SectionTitle>
      {rows.length ? (
        <Card className="divide-y divide-line p-0">
          {rows.map((i) => {
            const issues = Object.values(i.checklist).filter((v) => v === "check").length;
            return (
              <Link key={i.id} href={`/admin/inspecciones/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {i.drivers.profiles.full_name} · {i.motorcycles.plate}
                  </p>
                  <p className="text-xs text-ink-2">
                    {formatDate(i.inspected_on)} · {i.km.toLocaleString("es-CO")} km
                  </p>
                </div>
                {issues ? <Badge tone="warn">{issues} por revisar</Badge> : <Badge tone="ok">Todo bien</Badge>}
                {i.reviewed_at ? <Badge>Revisada</Badge> : <Badge tone="info">Nueva</Badge>}
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="Aún no hay inspecciones." />
      )}
    </>
  );
}
