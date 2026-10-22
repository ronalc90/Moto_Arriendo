import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { bogotaToday } from "@/lib/format";

const COP = '"$"#,##0';

function toDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Excel export of payments or expenses (admins only; RLS applies too). */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin" || !profile.active) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const tipo = request.nextUrl.searchParams.get("tipo") === "gastos" ? "gastos" : "pagos";
  const moto = request.nextUrl.searchParams.get("moto");
  const supabase = await createClient();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moto Arriendo";
  wb.created = new Date();

  if (tipo === "pagos") {
    let q = supabase
      .from("payments")
      .select(
        "paid_on, created_at, total_amount, rate_amount, installment_amount, method, status, rejection_reason, reviewed_at, motorcycles!inner(plate, owner_id, profiles!motorcycles_owner_id_fkey(full_name)), drivers!inner(national_id, profiles!inner(full_name))",
      )
      .order("paid_on");
    if (moto) q = q.eq("motorcycle_id", moto);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const ws = wb.addWorksheet("Pagos");
    ws.columns = [
      { header: "Fecha de pago", key: "paid_on", width: 14, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Conductor", key: "driver", width: 26 },
      { header: "Cédula", key: "cc", width: 14 },
      { header: "Moto", key: "plate", width: 10 },
      { header: "Propietario", key: "owner", width: 20 },
      { header: "Total", key: "total", width: 14, style: { numFmt: COP } },
      { header: "Tarifa", key: "rate", width: 14, style: { numFmt: COP } },
      { header: "Abono préstamo", key: "inst", width: 16, style: { numFmt: COP } },
      { header: "Método", key: "method", width: 14 },
      { header: "Estado", key: "status", width: 12 },
      { header: "Motivo rechazo", key: "reason", width: 30 },
    ];
    for (const r of (data ?? []) as unknown as Array<{
      paid_on: string;
      total_amount: number;
      rate_amount: number;
      installment_amount: number;
      method: string;
      status: string;
      rejection_reason: string | null;
      motorcycles: { plate: string; profiles: { full_name: string } | null };
      drivers: { national_id: string; profiles: { full_name: string } };
    }>) {
      ws.addRow({
        paid_on: toDate(r.paid_on),
        driver: r.drivers.profiles.full_name,
        cc: r.drivers.national_id,
        plate: r.motorcycles.plate,
        owner: r.motorcycles.profiles?.full_name ?? "",
        total: r.total_amount,
        rate: r.rate_amount,
        inst: r.installment_amount,
        method: PAYMENT_METHOD_LABEL[r.method] ?? r.method,
        status: PAYMENT_STATUS_LABEL[r.status] ?? r.status,
        reason: r.rejection_reason ?? "",
      });
    }
  } else {
    let q = supabase.from("motorcycle_costs").select("*").order("cost_date");
    if (moto) q = q.eq("motorcycle_id", moto);
    const [{ data, error }, { data: motos }] = await Promise.all([q, supabase.from("motorcycles").select("id, plate")]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const plate = new Map((motos ?? []).map((m) => [m.id, m.plate]));
    const ws = wb.addWorksheet("Gastos");
    ws.columns = [
      { header: "Fecha", key: "date", width: 14, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Moto", key: "plate", width: 10 },
      { header: "Categoría", key: "category", width: 18 },
      { header: "Origen", key: "source", width: 16 },
      { header: "Descripción", key: "description", width: 40 },
      { header: "Valor", key: "amount", width: 14, style: { numFmt: COP } },
    ];
    const SOURCE: Record<string, string> = { expense: "Gasto", maintenance: "Mantenimiento", incident: "Incidente" };
    for (const r of (data ?? []) as Array<{ cost_date: string; motorcycle_id: string; category: string; source: string; description: string; amount: number }>) {
      ws.addRow({
        date: toDate(r.cost_date),
        plate: plate.get(r.motorcycle_id) ?? "",
        category: EXPENSE_CATEGORY_LABEL[r.category] ?? r.category,
        source: SOURCE[r.source] ?? r.source,
        description: r.description,
        amount: r.amount,
      });
    }
  }

  const ws = wb.worksheets[0];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  const last = ws.rowCount + 1;
  const sumCols = tipo === "pagos" ? ["F", "G", "H"] : ["F"];
  if (ws.rowCount > 1) {
    const total = ws.getRow(last);
    total.getCell(1).value = "TOTAL";
    for (const c of sumCols) {
      total.getCell(c).value = { formula: `SUM(${c}2:${c}${last - 1})` };
      total.getCell(c).numFmt = COP;
    }
    total.font = { bold: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="moto-arriendo-${tipo}-${bogotaToday()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
