import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { getDriverContext } from "@/lib/driver";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Subir pago" };

export default async function PayPage() {
  const ctx = await getDriverContext();
  if (!ctx.contract || !ctx.summary) {
    return (
      <Card>
        <p className="text-ink-2">No tienes un contrato vigente.</p>
      </Card>
    );
  }
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("payments")
    .select("method")
    .eq("driver_id", ctx.driver.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const s = ctx.summary;
  const loan = ctx.loans.find((l) => l.status === "active");

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Subir pago</h1>
      <p className="mt-1 text-sm text-ink-2">
        Tarifa {formatCOP(s.daily_rate)}
        {loan ? ` + abono ${formatCOP(loan.daily_installment)}` : ""} · Debes hoy {formatCOP(s.due_today)}
      </p>
      <div className="mt-5">
        <PaymentForm
          driverId={ctx.driver.id}
          suggested={s.suggested_payment}
          defaultMethod={(last?.method as string) ?? "nequi"}
        />
      </div>
    </>
  );
}
