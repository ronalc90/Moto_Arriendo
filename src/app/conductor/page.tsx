import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireDriver } from "@/lib/auth";

export const metadata: Metadata = { title: "Inicio" };

export default async function DriverHome() {
  const profile = await requireDriver();
  return (
    <>
      <PageHeader title={`Hola, ${profile.full_name.split(" ")[0]}`} />
      <Card>
        <p className="text-ink-2">Tu inicio con el semáforo, lo que debes hoy y el botón para pagar llega en la Fase 1.</p>
      </Card>
    </>
  );
}
