"use client";

import { useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";

/** Compact money for axis ticks: $1,2 M / $350 mil */
function short(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `${sign}$${Math.round(a / 1_000)} mil`;
  return `${sign}$${a}`;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10;
  return step * p;
}

const H = 260;

/** Measures the container so the SVG uses real pixels (readable labels on phones). */
function useWidth() {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
const PAD = { top: 16, right: 30, bottom: 30, left: 64 };

type Point = { label: string; income: number; costs: number };

/** Grouped bars: income vs costs per month, with hover tooltip. */
export function MonthlyBars({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth();
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.income, d.costs])));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const band = iw / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(18, (band - 10) / 2));
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <figure ref={ref} className="relative">
      <Legend items={[{ label: "Ingresos (tarifas)", color: "var(--series-1)" }, { label: "Gastos", color: "var(--series-2)" }]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Ingresos y gastos por mes">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-3 text-[11px]">
              {short(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          return (
            <g key={d.label}>
              {hover === i ? <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill="var(--surface-2)" /> : null}
              <Bar x={cx - barW - 1} y={y(d.income)} w={barW} h={PAD.top + ih - y(d.income)} color="var(--series-1)" />
              <Bar x={cx + 1} y={y(d.costs)} w={barW} h={PAD.top + ih - y(d.costs)} color="var(--series-2)" />
              <text x={cx} y={H - 10} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {band < 44 && i % 2 ? "" : d.label}
              </text>
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={ih + PAD.bottom}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ingresos ${formatCOP(d.income)}, gastos ${formatCOP(d.costs)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + ih} y2={PAD.top + ih} stroke="var(--ink-3)" strokeWidth={1} />
      </svg>
      {hover !== null ? (
        <Tooltip
          leftPct={((PAD.left + band * hover + band / 2) / W) * 100}
          title={data[hover].label}
          rows={[
            { label: "Ingresos", value: formatCOP(data[hover].income), color: "var(--series-1)" },
            { label: "Gastos", value: formatCOP(data[hover].costs), color: "var(--series-2)" },
            { label: "Neto", value: formatCOP(data[hover].income - data[hover].costs) },
          ]}
        />
      ) : null}
    </figure>
  );
}

function Bar({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  if (h <= 0) return null;
  const r = Math.min(4, w / 2, h);
  // Rounded top (data end), square at the baseline.
  return (
    <path
      d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`}
      fill={color}
    />
  );
}

/** Cumulative net vs. the purchase price (payback line). */
export function PaybackLine({ data, target }: { data: { label: string; value: number }[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth();
  const values = data.map((d) => d.value);
  const max = niceMax(Math.max(target, 1, ...values));
  const lowest = Math.min(0, ...values);
  const min = lowest < 0 ? -niceMax(-lowest) : 0;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const ticks = [...(min < 0 && -min > max * 0.15 ? [min] : []), ...[0, 0.25, 0.5, 0.75, 1].map((t) => t * max)];

  return (
    <figure ref={ref} className="relative">
      <Legend
        items={[
          { label: "Neto acumulado", color: "var(--series-1)" },
          { label: `Inversión ${short(target)}`, color: "var(--ink-3)", dashed: true },
        ]}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Recuperación de la inversión">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-3 text-[11px]">
              {short(t)}
            </text>
          </g>
        ))}
        {target > 0 ? (
          <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="6 5" />
        ) : null}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--ink-3)" strokeWidth={1} /> : null}
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-3 text-[11px]">
              {data.length > Math.floor(W / 70) && i % Math.ceil(data.length / Math.floor(W / 70)) ? "" : d.label}
            </text>
            <rect
              x={x(i) - iw / Math.max(2, data.length) / 2}
              y={PAD.top}
              width={iw / Math.max(2, data.length)}
              height={ih}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.label}: ${formatCOP(d.value)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover !== null ? (
        <Tooltip
          leftPct={(x(hover) / W) * 100}
          title={data[hover].label}
          rows={[
            { label: "Neto acumulado", value: formatCOP(data[hover].value), color: "var(--series-1)" },
            { label: "Falta", value: formatCOP(Math.max(target - data[hover].value, 0)) },
          ]}
        />
      ) : null}
    </figure>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden>
            <line x1="0" x2="16" y1="4" y2="4" stroke={i.color} strokeWidth={i.dashed ? 1.5 : 3} strokeDasharray={i.dashed ? "4 3" : undefined} strokeLinecap="round" />
          </svg>
          {i.label}
        </span>
      ))}
    </figcaption>
  );
}

function Tooltip({
  leftPct,
  title,
  rows,
}: {
  leftPct: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div
      className="pointer-events-none absolute top-6 z-10 min-w-40 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: `${Math.min(85, Math.max(15, leftPct))}%` }}
    >
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-3 text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            {r.color ? (
              <svg width="12" height="6" aria-hidden>
                <line x1="0" x2="12" y1="3" y2="3" stroke={r.color} strokeWidth={3} strokeLinecap="round" />
              </svg>
            ) : null}
            {r.label}
          </span>
          <strong className="tabular text-ink">{r.value}</strong>
        </p>
      ))}
    </div>
  );
}
