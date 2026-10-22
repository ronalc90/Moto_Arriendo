import type { Metadata } from "next";
import { Download } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, buttonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMotorcycleOptions } from "@/lib/admin";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/constants";
import { bogotaToday, formatCOP, formatDate } from "@/lib/format";
import { deleteExpense } from "./actions";
import { ExpenseForm } from "./expense-form";

export const metadata: Metadata = { title: "Gastos" };

type Cost = {
  motorcycle_id: string;
  cost_date: string;
  category: string;
  amount: number;
  description: string;
  source: "expense" | "maintenance" | "incident";
  source_id: string;
};

const SOURCE_LABEL = { expense: "Gasto", maintenance: "Mantenimiento", incident: "Incidente" };

export default async function ExpensesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [motos, { data }] = await Promise.all([
    getMotorcycleOptions(),
    supabase.from("motorcycle_costs").select("*").order("cost_date", { ascending: false }).limit(300),
  ]);
  const plates = new Map(motos.map((m) => [m.value, m.label.split(" · ")[0]]));
  const rows = (data as Cost[]) ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHeader
        title="Gastos"
        subtitle="Todo lo que paga el propietario: SOAT, seguro, GPS, impuestos, mantenimientos y multas."
        action={
          <a href="/api/exportar?tipo=gastos" className={buttonClass("secondary", "md")}>
            <Download className="size-4" /> Excel
          </a>
        }
      />
      <Card className="max-w-3xl">
        <ExpenseForm motos={motos} today={bogotaToday()} />
      </Card>

      <SectionTitle>Registrados · {formatCOP(total)}</SectionTitle>
      {rows.length ? (
        <Card className="divide-y divide-line p-0">
          {rows.map((r) => (
            <div key={`${r.source}-${r.source_id}`} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {EXPENSE_CATEGORY_LABEL[r.category] ?? r.category} · {plates.get(r.motorcycle_id) ?? ""}
                </p>
                <p className="truncate text-xs text-ink-2">
                  {formatDate(r.cost_date)}
                  {r.description ? ` · ${r.description}` : ""}
                </p>
              </div>
              <Badge>{SOURCE_LABEL[r.source]}</Badge>
              <p className="w-28 text-right font-semibold tabular">{formatCOP(r.amount)}</p>
              {r.source === "expense" ? <DeleteButton action={deleteExpense} id={r.source_id} /> : <span className="w-8" />}
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title="Sin gastos registrados." />
      )}
    </>
  );
}
