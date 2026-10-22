import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DAMAGE_STATUS_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { DamageReport } from "@/lib/types";

export const metadata: Metadata = { title: "Daños" };

type Row = DamageReport & { motorcycles: { plate: string }; drivers: { profiles: { full_name: string } } };

export default async function DamagesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("damage_reports")
    .select("*, motorcycles(plate), drivers(profiles(full_name))")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data as Row[]) ?? [];
  const open = rows.filter((r) => r.status !== "closed");
  const closed = rows.filter((r) => r.status === "closed");

  const list = (items: Row[]) => (
    <Card className="divide-y divide-line p-0">
      {items.map((d) => (
        <Link key={d.id} href={`/admin/danos/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {d.motorcycles.plate} · {d.drivers.profiles.full_name}
            </p>
            <p className="truncate text-sm text-ink-2">{d.description}</p>
            <p className="text-xs text-ink-3">
              {formatDate(d.reported_on)} · {d.photos.length} foto(s)
            </p>
          </div>
          <Badge tone={d.status === "closed" ? "ok" : d.status === "in_repair" ? "info" : "warn"}>
            {DAMAGE_STATUS_LABEL[d.status]}
          </Badge>
          <ChevronRight className="size-5 text-ink-3" />
        </Link>
      ))}
    </Card>
  );

  return (
    <>
      <PageHeader title="Reportes de daño" subtitle="Lo que reportan los conductores desde la app." />
      <SectionTitle>Abiertos</SectionTitle>
      {open.length ? list(open) : <EmptyState title="No hay daños abiertos ✓" />}
      {closed.length ? (
        <>
          <SectionTitle>Cerrados</SectionTitle>
          {list(closed)}
        </>
      ) : null}
    </>
  );
}
