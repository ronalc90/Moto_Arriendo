import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Tiny className joiner. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "md" | "lg" | "sm";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong active:bg-brand-strong font-semibold",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-bad text-white hover:opacity-90",
  success: "bg-ok text-white hover:opacity-90",
};
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-[15px] rounded-xl",
  lg: "h-14 px-5 text-lg rounded-2xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 transition-colors select-none",
    "disabled:opacity-50 disabled:pointer-events-none",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-2xl bg-surface border border-line p-4 sm:p-5", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

type BadgeTone = "neutral" | "ok" | "warn" | "bad" | "info" | "brand";
const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand text-brand-ink",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "block w-full h-12 rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-3 " +
  "focus:border-brand-strong focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, "appearance-auto", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cx(inputClass, "h-auto min-h-24 py-3", props.className)}
    />
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "ok" | "warn" | "bad";
  children: ReactNode;
}) {
  const cls = {
    info: "bg-info-soft text-info",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  }[tone];
  return <div className={cx("rounded-xl px-4 py-3 text-sm font-medium", cls)} role="status">{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ok" | "warn" | "bad";
}) {
  const valueTone = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-ink";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <p className={cx("mt-1 text-2xl font-bold tabular", valueTone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-2">{hint}</p> : null}
    </Card>
  );
}
