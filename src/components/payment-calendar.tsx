import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/components/ui";
import { MONTHS, formatCOP, weekday } from "@/lib/format";
import type { CalendarDay } from "@/lib/types";

const KIND_STYLE: Record<CalendarDay["kind"], string> = {
  paid: "bg-ok text-white",
  partial: "bg-ok-soft text-ok ring-1 ring-ok/40",
  overdue: "bg-bad text-white",
  today: "bg-brand text-brand-ink ring-2 ring-brand-strong",
  upcoming: "bg-surface text-ink-2 ring-1 ring-line",
  rest: "bg-info-soft text-info",
  exempt: "bg-surface-2 text-ink-3 line-through",
  none: "text-ink-3/40",
};

export const KIND_LABEL: Record<CalendarDay["kind"], string> = {
  paid: "Pagado",
  partial: "Pago parcial",
  overdue: "Pendiente (vencido)",
  today: "Hoy por pagar",
  upcoming: "Próximo",
  rest: "Descanso",
  exempt: "Exento",
  none: "Sin contrato",
};

/** Month grid (Monday first) with one colored cell per day. */
export function PaymentCalendar({
  month,
  days,
  basePath,
}: {
  month: string; // YYYY-MM
  days: CalendarDay[];
  basePath: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const first = `${month}-01`;
  const offset = (weekday(first) + 6) % 7; // Monday = 0
  const sep = basePath.includes("?") ? "&" : "?";

  const counts = days.reduce<Record<string, number>>((acc, d) => {
    acc[d.kind] = (acc[d.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={`${basePath}${sep}mes=${prev}`} className="rounded-xl p-2 hover:bg-surface-2" aria-label="Mes anterior">
          <ChevronLeft className="size-6" />
        </Link>
        <p className="text-lg font-semibold capitalize">
          {MONTHS[m - 1]} {y}
        </p>
        <Link href={`${basePath}${sep}mes=${next}`} className="rounded-xl p-2 hover:bg-surface-2" aria-label="Mes siguiente">
          <ChevronRight className="size-6" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-ink-3">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="pb-1">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map((d) => (
          <div
            key={d.day}
            title={`${KIND_LABEL[d.kind]}${d.exempt_reason ? `: ${d.exempt_reason}` : ""}${
              d.kind === "partial" ? ` (${formatCOP(d.amount_covered)})` : ""
            }`}
            className={cx(
              "flex aspect-square items-center justify-center rounded-xl text-sm font-semibold tabular",
              KIND_STYLE[d.kind],
            )}
          >
            {Number(d.day.slice(8))}
          </div>
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-2 text-sm">
        {(["paid", "partial", "overdue", "today", "upcoming", "rest", "exempt"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={cx("size-4 shrink-0 rounded-md", KIND_STYLE[k])} />
            <span className="text-ink-2">
              {KIND_LABEL[k]}
              {counts[k] ? <span className="font-semibold text-ink"> · {counts[k]}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Returns the first/last day of a YYYY-MM month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function parseMonth(value: unknown, fallback: string) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}
