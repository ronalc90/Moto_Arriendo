import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INCIDENT_KIND_LABEL, RESPONSIBLE_LABEL } from "@/lib/constants";
import { formatCOP, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Incidentes" };

type Row = {
  id: string;
  kind: string;
  occurred_on: string;
  description: string;
  responsible: string;
  cost: number;
  paid_by: string;
  status: "open" | "closed";
  motorcycles: { plate: string };
  drivers: { profiles: { full_name: string } } | null;
};

export default async function IncidentsPage({ searchParams }: PageProps<"/admin/incidentes">) {
  await requireAdmin();
  const sp = await searchParams;
  const moto = typeof sp.moto === "string" ? sp.moto : "";
  const supabase = await createClient();
  let q = supabase
    .from("incidents")
    .select("id, kind, occurred_on, description, responsible, cost, paid_by, status, motorcycles(plate), drivers(profiles(full_name))")
    .order("occurred_on", { ascending: false })
    .limit(200);
  if (moto) q = q.eq("motorcycle_id", moto);
  const { data } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader
        title="Incidentes"
        subtitle="Accidentes, multas, inmovilizaciones y robos."
        action={
          <ButtonLink href={`/admin/incidentes/nuevo${moto ? `?moto=${moto}` : ""}`}>
            <Plus className="size-5" /> <span className="hidden sm:inline">Nuevo incidente</span>
          </ButtonLink>
        }
      />
      {rows.length ? (
        <Card className="divide-y divide-line p-0">
          {rows.map((i) => (
            <Link key={i.id} href={`/admin/incidentes/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {INCIDENT_KIND_LABEL[i.kind]} · {i.motorcycles.plate}
                  {i.drivers ? ` · ${i.drivers.profiles.full_name}` : ""}
                </p>
                <p className="truncate text-sm text-ink-2">{i.description}</p>
                <p className="text-xs text-ink-3">
                  {formatDate(i.occurred_on)} · responsable: {RESPONSIBLE_LABEL[i.responsible]} · pagó: {RESPONSIBLE_LABEL[i.paid_by]}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular">{formatCOP(i.cost)}</p>
                <Badge tone={i.status === "open" ? "warn" : "ok"}>{i.status === "open" ? "Abierto" : "Cerrado"}</Badge>
              </div>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="Sin incidentes registrados ✓" />
      )}
    </>
  );
}
