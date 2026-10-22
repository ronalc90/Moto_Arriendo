import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDriverOptions } from "@/lib/admin";
import { bogotaToday, formatThousands } from "@/lib/format";
import { createLoan } from "../actions";

export const metadata: Metadata = { title: "Nuevo préstamo" };

export default async function NewLoanPage({ searchParams }: PageProps<"/admin/prestamos/nuevo">) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [drivers, { data: settings }] = await Promise.all([
    getDriverOptions(true),
    supabase.from("settings").select("default_daily_installment").eq("id", 1).single(),
  ]);
  return (
    <>
      <Link href="/admin/prestamos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Préstamos
      </Link>
      <PageHeader title="Nuevo préstamo" />
      <Card className="max-w-xl">
        <ActionForm action={createLoan} submitLabel="Crear préstamo">
          <Field label="Conductor" htmlFor="driver_id">
            <Select id="driver_id" name="driver_id" defaultValue={typeof sp.conductor === "string" ? sp.conductor : ""} required>
              <option value="" disabled>
                Elige…
              </option>
              {drivers.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Concepto" htmlFor="concept">
            <Input id="concept" name="concept" defaultValue="Pase A2" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto prestado" htmlFor="amount">
              <Input id="amount" name="amount" inputMode="numeric" placeholder="1.200.000" required />
            </Field>
            <Field label="Abono diario" htmlFor="daily_installment">
              <Input
                id="daily_installment"
                name="daily_installment"
                inputMode="numeric"
                defaultValue={formatThousands(settings?.default_daily_installment ?? 10000)}
              />
            </Field>
          </div>
          <Field label="Fecha del préstamo" htmlFor="loan_date" hint="Desde esta fecha empieza a contar el abono diario.">
            <Input id="loan_date" name="loan_date" type="date" defaultValue={bogotaToday()} required />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" name="installment_required" defaultChecked className="mt-0.5 size-5 accent-[var(--brand-strong)]" />
            <span className="text-sm">
              <strong>Abono obligatorio.</strong> Si no lo paga, suma deuda y afecta el semáforo. Desmárcalo para que sea
              voluntario.
            </span>
          </label>
          <Field label="Notas" htmlFor="notes">
            <Textarea id="notes" name="notes" />
          </Field>
        </ActionForm>
      </Card>
    </>
  );
}
