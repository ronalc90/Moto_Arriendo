import type { Metadata } from "next";
import { Card, Stat } from "@/components/ui";
import { PaymentCalendar, monthRange, parseMonth } from "@/components/payment-calendar";
import { getDriverContext } from "@/lib/driver";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday, formatCOP, formatDate } from "@/lib/format";
import type { CalendarDay } from "@/lib/types";

export const metadata: Metadata = { title: "Mi calendario" };

export default async function DriverCalendarPage({ searchParams }: PageProps<"/conductor/calendario">) {
  const ctx = await getDriverContext();
  if (!ctx.contract || !ctx.summary) {
    return (
      <Card>
        <p className="text-ink-2">No tienes un contrato vigente.</p>
      </Card>
    );
  }
  const params = await searchParams;
  const month = parseMonth(params.mes, bogotaToday().slice(0, 7));
  const { from, to } = monthRange(month);
  const supabase = await createClient();
  const { data } = await supabase.rpc("contract_calendar", {
    p_contract_id: ctx.contract.id,
    p_from: from,
    p_to: to,
  });
  const s = ctx.summary;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Mi calendario</h1>
      <p className="mb-4 text-sm text-ink-2">Contrato desde el {formatDate(ctx.contract.start_date)}</p>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat label="Días cobrados" value={s.chargeable_days} hint={`${formatCOP(s.expected_rate)} en total`} />
        <Stat
          label={s.rate_balance < 0 ? "Pagado de más" : "Saldo tarifa"}
          value={formatCOP(Math.abs(s.rate_balance))}
          tone={s.rate_balance > 0 ? "bad" : "ok"}
        />
      </div>
      <Card>
        <PaymentCalendar month={month} days={(data as CalendarDay[]) ?? []} basePath="/conductor/calendario" />
      </Card>
    </>
  );
}
