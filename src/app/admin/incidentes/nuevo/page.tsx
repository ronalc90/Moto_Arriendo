import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDriverOptions, getMotorcycleOptions } from "@/lib/admin";
import { bogotaToday } from "@/lib/format";
import { IncidentForm } from "./incident-form";

export const metadata: Metadata = { title: "Nuevo incidente" };

export default async function NewIncidentPage({ searchParams }: PageProps<"/admin/incidentes/nuevo">) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [motos, drivers, { data: active }] = await Promise.all([
    getMotorcycleOptions(),
    getDriverOptions(false),
    supabase.from("contracts").select("motorcycle_id, driver_id").eq("status", "active"),
  ]);
  const currentDriver = Object.fromEntries((active ?? []).map((a) => [a.motorcycle_id, a.driver_id]));
  return (
    <>
      <Link href="/admin/incidentes" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Incidentes
      </Link>
      <PageHeader title="Nuevo incidente" />
      <Card className="max-w-3xl">
        <IncidentForm
          motos={motos}
          drivers={drivers}
          currentDriver={currentDriver}
          defaultMoto={typeof sp.moto === "string" ? sp.moto : ""}
          today={bogotaToday()}
        />
      </Card>
    </>
  );
}
