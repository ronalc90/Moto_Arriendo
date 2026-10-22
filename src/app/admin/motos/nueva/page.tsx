import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getOwners } from "@/lib/admin";
import { createMotorcycle } from "../actions";
import { MotorcycleFields } from "../motorcycle-fields";

export const metadata: Metadata = { title: "Nueva moto" };

export default async function NewMotorcyclePage() {
  const profile = await requireAdmin();
  const owners = await getOwners();
  return (
    <>
      <Link href="/admin/motos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Motos
      </Link>
      <PageHeader title="Nueva moto" />
      <Card className="max-w-3xl">
        <ActionForm action={createMotorcycle} submitLabel="Guardar moto">
          <MotorcycleFields owners={owners} defaultOwner={profile.id} />
        </ActionForm>
      </Card>
    </>
  );
}
