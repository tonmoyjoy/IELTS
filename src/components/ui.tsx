import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatBand } from "@/lib/bands";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-btn text-on-accent shadow-soft hover:bg-accent-btn-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-bad text-on-accent hover:opacity-90",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-soft ${className}`} {...props} />;
}

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, string> = {
  info: "border-info/30 bg-info-soft text-info",
  success: "border-good/30 bg-good-soft text-good",
  warning: "border-warn/30 bg-warn-soft text-warn",
  error: "border-bad/30 bg-bad-soft text-bad",
};

export function Alert({ tone = "info", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">{children}</p>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2.5 text-[15px] leading-7 text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function BandBadge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm", lg: "px-3.5 py-1.5 text-lg" };
  return (
    <span className={`inline-flex items-center rounded-full bg-accent-soft font-semibold tabular-nums text-accent-text ${sizes[size]}`}>
      Band {formatBand(score)}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-serif text-lg font-medium text-ink">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, max = 9, label }: { value: number | null; max?: number; label?: string }) {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-sunken"
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
      aria-valuenow={label && value != null ? value : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Chip({ active, className = "", ...props }: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent-btn text-on-accent" : "border border-line-strong text-ink-soft hover:bg-sunken hover:text-ink"
      } ${className}`}
      {...props}
    />
  );
}

export const inputClass =
  "mt-1.5 block w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export const labelClass = "text-sm font-medium text-ink";
