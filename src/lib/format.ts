/**
 * Formatting helpers. Currency: COP without decimals ($40.000).
 * Dates: dd/mm/aaaa. Time zone: America/Bogota for everything.
 */

export const TIME_ZONE = "America/Bogota";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** 40000 -> "$40.000" (Intl inserts a non-breaking space; we remove it). */
export function formatCOP(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return copFormatter.format(Math.round(n)).replace(/\s/g, "");
}

/** 40000 -> "40.000" (for inputs) */
export function formatThousands(value: number | string | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

/** "40.000" / "$ 40,000" -> 40000 */
export function parseCOP(input: string | null | undefined): number {
  const digits = String(input ?? "").replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "2026-10-21" (a date-only value) -> "21/10/2026" without time zone shifts. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

/** Timestamp -> "21/10/2026 9:05 p. m." in Bogota time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const time = new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${formatDate(date)} ${time}`;
}

/** Today's date in Bogota as "YYYY-MM-DD". */
export function bogotaToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA already formats as YYYY-MM-DD
}

/** Adds days to a "YYYY-MM-DD" string (pure date math, no time zones). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Day of week (0 = domingo) of a "YYYY-MM-DD" string. */
export function weekday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "21:00:00" -> "9:00 p. m." */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m)} ${suffix}`;
}

/** Colombian mobile: keep digits, drop +57 prefix. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  return digits;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length !== 10) return phone;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}
