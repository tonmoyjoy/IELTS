import { formatBand } from "@/lib/bands";

export function CriteriaTable({ rows }: { rows: Array<{ label: string; score: number }> }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <dt className="text-xs text-zinc-500">{row.label}</dt>
          <dd className="mt-0.5 flex items-center gap-3">
            <span className="text-lg font-semibold tabular-nums">{formatBand(row.score)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
              <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${(row.score / 9) * 100}%` }} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FeedbackLists({ strengths, improvements }: { strengths: string[]; improvements: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">What worked</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {strengths.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Improve next time</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {improvements.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}
