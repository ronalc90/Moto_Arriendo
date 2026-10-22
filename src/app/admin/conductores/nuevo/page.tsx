import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { Collapsible } from "@/components/collapsible";
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
        subtitle="Solo necesitas su nombre, un usuario y una contraseña inicial. Sus demás datos los llena él al entrar por primera vez."
      />
      <Card className="max-w-3xl">
        <ActionForm action={createDriver} submitLabel="Crear conductor" pendingLabel="Creando…">
          <div className="grid gap-4 rounded-2xl bg-surface-2/60 p-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="full_name">
              <Input id="full_name" name="full_name" required autoComplete="off" placeholder="Hamer" />
            </Field>
            <Field label="Usuario para entrar" htmlFor="username" hint="Sin espacios, ej: hamer. Puedes dejarlo vacío si usas el celular.">
              <Input id="username" name="username" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="hamer" />
            </Field>
            <Field label="Celular (opcional)" htmlFor="phone" hint="10 dígitos. Si no pones usuario, entra con el celular.">
              <Input id="phone" name="phone" inputMode="tel" autoComplete="off" />
            </Field>
            <Field label="Contraseña inicial" htmlFor="password" hint="Mínimo 4 caracteres. Al entrar por primera vez la app le pide cambiarla.">
              <Input id="password" name="password" required minLength={4} autoComplete="new-password" />
            </Field>
          </div>
          <Collapsible title="Más datos (opcional: el conductor los llena al entrar)">
            <DriverFields hideName />
          </Collapsible>
        </ActionForm>
      </Card>
    </>
  );
}
