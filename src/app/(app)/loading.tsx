export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
