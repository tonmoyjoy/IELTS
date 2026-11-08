import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth/session";
import { listAttempts } from "@/server/services/attempts";
import { BandBadge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { MODULE_LABELS, MODULES, isModule } from "@/lib/modules";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const user = await requirePageUser("/history");
  const params = await searchParams;
  const moduleFilter = isModule(params.module) ? params.module : undefined;
  const beforeRaw = typeof params.before === "string" ? new Date(params.before) : undefined;
  const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : undefined;

  const { attempts, nextCursor } = await listAttempts(user.id, { module: moduleFilter, before, limit: 25 });

  const filterHref = (module?: string) => (module ? `/history?module=${module}` : "/history");
  const nextHref = nextCursor
    ? `/history?${new URLSearchParams({ ...(moduleFilter ? { module: moduleFilter } : {}), before: nextCursor }).toString()}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="History" title="Your attempts" description="Every graded attempt, newest first. Open one to see the full feedback." />

      <nav aria-label="Filter by module" className="flex flex-wrap gap-2">
        {[undefined, ...MODULES].map((module) => {
          const active = module === moduleFilter;
          return (
            <Link
              key={module ?? "all"}
              href={filterHref(module)}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-accent-btn text-on-accent" : "border border-line-strong text-ink-soft hover:bg-sunken"
              }`}
            >
              {module ? MODULE_LABELS[module] : "All"}
            </Link>
          );
        })}
      </nav>

      {attempts.length === 0 ? (
        <EmptyState
          title={before ? "No older attempts" : "No attempts yet"}
          description="Your graded practice will appear here."
          action={<ButtonLink href="/dashboard">Go to dashboard</ButtonLink>}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <Link href={`/history/${attempt.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-sunken">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{attempt.title}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {MODULE_LABELS[attempt.module]} ·{" "}
                      {new Date(attempt.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      {attempt.summary && attempt.totalQuestions ? ` · ${attempt.summary}` : ""}
                    </p>
                  </div>
                  <BandBadge score={attempt.score} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {nextHref && (
        <div className="text-center">
          <ButtonLink href={nextHref} variant="secondary">Older attempts</ButtonLink>
        </div>
      )}
    </div>
  );
}
