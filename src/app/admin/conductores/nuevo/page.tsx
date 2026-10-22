import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createDriver } from "../actions";
import { DriverFields } from "../driver-fields";

export const metadata: Metadata = { title: "Nuevo conductor" };

export default async function NewDriverPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/conductores" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Conductores
      </Link>
      <PageHeader
        title="Nuevo conductor"
        subtitle="Se crea su usuario: entra a la app con su celular y la contraseña que pongas aquí."
      />
      <Card className="max-w-3xl">
        <ActionForm action={createDriver} submitLabel="Crear conductor" pendingLabel="Creando…">
          <div className="grid gap-4 rounded-2xl bg-surface-2/60 p-4 sm:grid-cols-2">
            <Field label="Celular (usuario)" htmlFor="phone" hint="10 dígitos, ej: 3001234567">
              <Input id="phone" name="phone" inputMode="tel" required autoComplete="off" />
            </Field>
            <Field label="Contraseña inicial" htmlFor="password" hint="Mínimo 8 caracteres. Él la puede cambiar luego.">
              <Input id="password" name="password" required minLength={8} autoComplete="new-password" />
            </Field>
          </div>
          <DriverFields />
        </ActionForm>
      </Card>
    </>
  );
}
