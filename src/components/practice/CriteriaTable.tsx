import { formatBand } from "@/lib/bands";

export function CriteriaTable({ rows }: { rows: Array<{ label: string; score: number }> }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-line px-3 py-2">
          <dt className="text-xs text-ink-faint">{row.label}</dt>
          <dd className="mt-0.5 flex items-center gap-3">
            <span className="text-lg font-semibold tabular-nums">{formatBand(row.score)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <span className="block h-full rounded-full bg-accent-btn" style={{ width: `${(row.score / 9) * 100}%` }} />
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
        <h3 className="text-sm font-semibold text-accent-text">What worked</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {strengths.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-warn">Improve next time</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {improvements.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}
