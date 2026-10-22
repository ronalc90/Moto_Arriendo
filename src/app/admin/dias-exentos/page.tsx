import type { Metadata } from "next";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveContractOptions } from "@/lib/admin";
import { ExemptDaysForm, ExemptDaysList } from "./exempt-components";

export const metadata: Metadata = { title: "Días exentos" };

export default async function ExemptDaysPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [contracts, { data }] = await Promise.all([
    getActiveContractOptions(),
    supabase
      .from("exempt_days")
      .select("id, day, reason, contracts!inner(motorcycles(plate), drivers(profiles(full_name)))")
      .order("day", { ascending: false })
      .limit(120),
  ]);
  const rows = ((data ?? []) as unknown as Array<{
    id: string;
    day: string;
    reason: string;
    contracts: { motorcycles: { plate: string }; drivers: { profiles: { full_name: string } } };
  }>).map((r) => ({
    id: r.id,
    day: r.day,
    reason: r.reason,
    label: `${r.contracts.drivers.profiles.full_name} · ${r.contracts.motorcycles.plate}`,
  }));

  return (
    <>
      <PageHeader title="Días exentos" subtitle="Días que no se cobran (ej: moto en taller por garantía)." />
      <Card className="max-w-xl">
        <ExemptDaysForm contracts={contracts} />
      </Card>
      <SectionTitle>Registrados</SectionTitle>
      <ExemptDaysList rows={rows} />
    </>
  );
}
