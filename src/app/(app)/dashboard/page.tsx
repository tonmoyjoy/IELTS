import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth/session";
import { getProgressStats, listAttempts } from "@/server/services/attempts";
import { getUsageSummary } from "@/server/billing/quota";
import { BandBadge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { TargetBandForm } from "@/components/dashboard/TargetBandForm";
import { MODULE_LABELS, MODULES, type IeltsModule } from "@/lib/modules";
import { formatBand } from "@/lib/bands";

export const metadata: Metadata = { title: "Dashboard" };

const PRACTICE_HREF: Record<IeltsModule, string> = {
  listening: "/practice/listening",
  reading: "/practice/reading",
  writing: "/practice/writing",
  speaking: "/practice/speaking",
};

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  const [stats, recent, usage] = await Promise.all([
    getProgressStats(user.id),
    listAttempts(user.id, { limit: 6 }),
    getUsageSummary(user.id, user.plan),
  ]);

  const practised = stats.modules.filter((m) => m.latest != null);
  const notStarted = stats.modules.filter((m) => m.latest == null);
  const weakest = [...practised].sort((a, b) => (a.latest ?? 0) - (b.latest ?? 0))[0];
  const gap = stats.estimatedOverall != null ? Math.max(0, user.targetBand - stats.estimatedOverall) : null;

  const nextStep: { title: string; body: string; href: string } =
    notStarted.length > 0
      ? {
          title: `Try ${MODULE_LABELS[notStarted[0].module]}`,
          body: `You haven't practised ${MODULE_LABELS[notStarted[0].module]} yet. One attempt gives you a starting band for that module.`,
          href: PRACTICE_HREF[notStarted[0].module],
        }
      : weakest && weakest.latest != null && weakest.latest < user.targetBand
        ? {
            title: `Focus on ${MODULE_LABELS[weakest.module]}`,
            body: `Your latest ${MODULE_LABELS[weakest.module]} band is ${formatBand(weakest.latest)}, ${formatBand(
              user.targetBand - weakest.latest
            )} below your target. It is your biggest opportunity.`,
            href: PRACTICE_HREF[weakest.module],
          }
        : {
            title: "Keep your streak going",
            body: "Every module is at or above your target. Try a different set to confirm your score is consistent.",
            href: "/practice/writing",
          };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Your IELTS progress"
        description="Estimated bands from your most recent attempt in each module."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimated overall</p>
          <p className="mt-3 text-5xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatBand(stats.estimatedOverall)}
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {stats.estimatedOverall == null
              ? "Complete any practice task to get your first estimate."
              : practised.length < 4
                ? `Based on ${practised.length} of 4 modules.`
                : "Based on all four modules."}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Target band</p>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-5xl font-bold tabular-nums text-zinc-900 dark:text-white">{formatBand(user.targetBand)}</p>
            {gap != null && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {gap === 0 ? "On target" : `${formatBand(gap)} to go`}
              </p>
            )}
          </div>
          <TargetBandForm initial={user.targetBand} />
        </Card>
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AI evaluations today</p>
          <ul className="mt-3 space-y-2 text-sm">
            {(["writing", "speaking"] as const).map((feature) => (
              <li key={feature} className="flex items-center justify-between">
                <span className="text-zinc-700 dark:text-zinc-300">{MODULE_LABELS[feature]}</span>
                <span className="tabular-nums font-medium">
                  {usage.features[feature].remaining} of {usage.features[feature].limit} left
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">Resets at 00:00 UTC. Listening and Reading are unlimited.</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Recommended next</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{nextStep.title}</h2>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{nextStep.body}</p>
        </div>
        <ButtonLink href={nextStep.href}>Start practising</ButtonLink>
      </Card>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-lg font-semibold text-zinc-950 dark:text-white">Modules</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => {
            const row = stats.modules.find((m) => m.module === module)!;
            const pct = row.latest == null ? 0 : Math.round((row.latest / 9) * 100);
            return (
              <Link key={module} href={PRACTICE_HREF[module]} className="group">
                <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-zinc-950 dark:text-white">{MODULE_LABELS[module]}</h3>
                    <span className="text-2xl font-semibold tabular-nums">{formatBand(row.latest)}</span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {row.attempts === 0
                      ? "Not started"
                      : `${row.attempts} attempt${row.attempts === 1 ? "" : "s"} · best ${formatBand(row.best)} · avg ${formatBand(row.average)}`}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="font-semibold text-zinc-950 dark:text-white">Recent scores</h2>
          <p className="text-xs text-zinc-500">Last {stats.trend.length} attempts, all modules</p>
          <div className="mt-4">
            {stats.trend.length > 1 ? (
              <TrendChart points={stats.trend} target={user.targetBand} />
            ) : (
              <EmptyState title="Not enough data yet" description="Complete two or more attempts to see your trend." />
            )}
          </div>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-950 dark:text-white">Latest attempts</h2>
            <Link href="/history" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              View all
            </Link>
          </div>
          {recent.attempts.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No attempts yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {recent.attempts.map((attempt) => (
                <li key={attempt.id}>
                  <Link href={`/history/${attempt.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{attempt.title}</p>
                      <p className="text-xs text-zinc-500">
                        {MODULE_LABELS[attempt.module]} · {new Date(attempt.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <BandBadge score={attempt.score} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
