import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getActiveContractOptions } from "@/lib/admin";
import { bogotaToday } from "@/lib/format";
import { createManualPayment } from "../actions";

export const metadata: Metadata = { title: "Registrar pago" };

export default async function NewPaymentPage({ searchParams }: PageProps<"/admin/pagos/nuevo">) {
  await requireAdmin();
  const params = await searchParams;
  const contracts = await getActiveContractOptions();
  const preset = typeof params.contrato === "string" ? params.contrato : "";
  const kind = params.tipo === "abono" ? "loan_only" : "regular";

  return (
    <>
      <Link href="/admin/pagos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Pagos
      </Link>
      <PageHeader
        title="Registrar pago"
        subtitle="Para pagos en efectivo o abonos extra al préstamo. Queda aprobado de una vez."
      />
      {contracts.length ? (
        <Card className="max-w-xl">
          <ActionForm action={createManualPayment} submitLabel="Registrar pago aprobado">
            <Field label="Conductor y moto" htmlFor="contract_id">
              <Select id="contract_id" name="contract_id" defaultValue={preset} required>
                <option value="" disabled>
                  Elige…
                </option>
                {contracts.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={kind}>
                <option value="regular">Pago normal (primero tarifa, luego abono)</option>
                <option value="loan_only">Abono extra al préstamo</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto" htmlFor="amount">
                <Input id="amount" name="amount" inputMode="numeric" placeholder="40.000" required />
              </Field>
              <Field label="Fecha" htmlFor="paid_on">
                <Input id="paid_on" name="paid_on" type="date" defaultValue={bogotaToday()} required />
              </Field>
            </div>
            <Field label="Método" htmlFor="method">
              <Select id="method" name="method" defaultValue="cash">
                <option value="cash">Efectivo</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="transfer">Transferencia</option>
              </Select>
            </Field>
            <FileUpload name="receipt" bucket="receipts" folder="admin" kind="document" label="Comprobante (opcional)" />
            <Field label="Notas" htmlFor="notes">
              <Input id="notes" name="notes" placeholder="Opcional" />
            </Field>
          </ActionForm>
        </Card>
      ) : (
        <EmptyState title="No hay contratos vigentes." />
      )}
    </>
  );
}
