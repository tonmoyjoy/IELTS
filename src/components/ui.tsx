import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-600/60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

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
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      {...props}
    />
  );
}

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  error: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
};

export function Alert({ tone = "info", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
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
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function BandBadge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  const text = score == null ? "–" : Number.isInteger(score) ? `${score}.0` : String(score);
  const sizes = { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm", lg: "px-3 py-1.5 text-lg" };
  return (
    <span
      className={`inline-flex items-center rounded-md bg-emerald-50 font-semibold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900 ${sizes[size]}`}
    >
      Band {text}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
