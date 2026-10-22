import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { bogotaToday } from "@/lib/format";

const COP = '"$"#,##0';
const PAGE = 1000; // Supabase returns at most 1.000 rows per request

/**
 * Reads every row by pages. A plain select silently stops at the API row
 * limit, which would leave the newest data out of the Excel without warning.
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return { rows, error: null };
  }
}

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
  const tipoParam = request.nextUrl.searchParams.get("tipo");
  if (tipoParam === "respaldo") return fullBackup();
  const tipo = tipoParam === "gastos" ? "gastos" : "pagos";
  const moto = request.nextUrl.searchParams.get("moto");
  const supabase = await createClient();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moto Arriendo";
  wb.created = new Date();

  if (tipo === "pagos") {
    const { rows: data, error } = await fetchAll((from, to) => {
      let q = supabase
        .from("payments")
        .select(
          "paid_on, created_at, total_amount, rate_amount, installment_amount, method, status, rejection_reason, reviewed_at, motorcycles!inner(plate, owner_id, profiles!motorcycles_owner_id_fkey(full_name)), drivers!inner(national_id, profiles!inner(full_name))",
        )
        .order("paid_on")
        .order("id");
      if (moto) q = q.eq("motorcycle_id", moto);
      return q.range(from, to);
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
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
    const [{ rows: data, error }, { data: motos }] = await Promise.all([
      fetchAll((from, to) => {
        let q = supabase
          .from("motorcycle_costs")
          .select("*")
          .order("cost_date")
          .order("motorcycle_id")
          .order("source")
          .order("amount")
          .order("description");
        if (moto) q = q.eq("motorcycle_id", moto);
        return q.range(from, to);
      }),
      supabase.from("motorcycles").select("id, plate"),
    ]);
    if (error) return NextResponse.json({ error }, { status: 500 });
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

/** Every business table in one workbook (one sheet per table) — a manual backup. */
async function fullBackup() {
  const supabase = await createClient();
  const tables: Array<[string, string]> = [
    ["Motos", "motorcycles"],
    ["Conductores", "drivers"],
    ["Usuarios", "profiles"],
    ["Contratos", "contracts"],
    ["Pagos", "payments"],
    ["Préstamos", "loans"],
    ["Días exentos", "exempt_days"],
    ["Documentos", "documents"],
    ["Inspecciones", "inspections"],
    ["Daños", "damage_reports"],
    ["Mantenimientos", "maintenance_records"],
    ["Incidentes", "incidents"],
    ["Gastos", "expenses"],
    ["Configuración", "settings"],
  ];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moto Arriendo";
  for (const [sheet, table] of tables) {
    const { rows, error } = await fetchAll<Record<string, unknown>>((from, to) =>
      supabase.from(table).select("*").order("id").range(from, to),
    );
    if (error) return NextResponse.json({ error: `${table}: ${error}` }, { status: 500 });
    const ws = wb.addWorksheet(sheet);
    const keys = rows.length ? Object.keys(rows[0]) : ["(sin datos)"];
    ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(12, k.length + 4)) }));
    for (const r of rows) {
      ws.addRow(
        Object.fromEntries(
          keys.map((k) => {
            const v = r[k];
            return [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v];
          }),
        ),
      );
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="moto-arriendo-respaldo-${bogotaToday()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
