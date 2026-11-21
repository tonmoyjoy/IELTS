import Link from "next/link";
import { BandBadge, Card } from "@/components/ui";

export type SetListItem = {
  href: string;
  title: string;
  summary: string;
  meta: string;
  best: number | null;
};

export function SetList({ items }: { items: SetListItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="group">
          <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-ink group-hover:text-accent-text">
                {item.title}
              </h2>
              {item.best != null && <BandBadge score={item.best} size="sm" />}
            </div>
            <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">{item.summary}</p>
            <p className="mt-4 text-xs text-ink-faint">{item.meta}{item.best != null ? " · your best shown" : ""}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function FullTestBanner({ href, title, meta, description }: { href: string; title: string; meta: string; description: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="flex flex-wrap items-center justify-between gap-4 border-accent bg-accent-soft p-5 transition-shadow group-hover:shadow-md">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Computer-delivered format</p>
          <h2 className="mt-1 font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{description}</p>
        </div>
        <span className="text-sm font-medium text-accent-text">{meta} →</span>
      </Card>
    </Link>
  );
}
