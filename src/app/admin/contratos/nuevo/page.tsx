import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDriverOptions, getMotorcycleOptions } from "@/lib/admin";
import { bogotaToday, formatThousands } from "@/lib/format";
import { ContractForm } from "./contract-form";

export const metadata: Metadata = { title: "Nuevo contrato" };

export default async function NewContractPage({ searchParams }: PageProps<"/admin/contratos/nuevo">) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [drivers, motos, { data: active }, { data: settings }] = await Promise.all([
    getDriverOptions(true),
    getMotorcycleOptions(),
    supabase.from("contracts").select("driver_id, motorcycle_id").eq("status", "active"),
    supabase.from("settings").select("default_daily_rate").eq("id", 1).single(),
  ]);
  const busyDrivers = new Set((active ?? []).map((a) => a.driver_id));
  const busyMotos = new Set((active ?? []).map((a) => a.motorcycle_id));
  const freeDrivers = drivers.filter((d) => !busyDrivers.has(d.value));
  const freeMotos = motos.filter((m) => !busyMotos.has(m.value));

  return (
    <>
      <Link href="/admin/contratos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Contratos
      </Link>
      <PageHeader title="Nuevo contrato" />
      {!freeDrivers.length || !freeMotos.length ? (
        <EmptyState title={!freeDrivers.length ? "No hay conductores disponibles." : "No hay motos disponibles."}>
          <Link href={!freeDrivers.length ? "/admin/conductores/nuevo" : "/admin/motos/nueva"} className="font-semibold text-info">
            {!freeDrivers.length ? "Crear conductor" : "Registrar moto"}
          </Link>
        </EmptyState>
      ) : (
        <Card className="max-w-3xl">
          <ContractForm
            drivers={freeDrivers}
            motorcycles={freeMotos}
            defaultDriver={typeof sp.conductor === "string" && freeDrivers.some((d) => d.value === sp.conductor) ? sp.conductor : ""}
            defaultMoto={typeof sp.moto === "string" && freeMotos.some((m) => m.value === sp.moto) ? sp.moto : ""}
            defaultRate={formatThousands(settings?.default_daily_rate ?? 40000)}
            today={bogotaToday()}
          />
        </Card>
      )}
    </>
  );
}
