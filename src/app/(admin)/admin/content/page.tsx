import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/session";
import { listContent } from "@/server/services/content-admin";
import { CONTENT_KINDS, CONTENT_STATUSES, type ContentKind, type ContentStatus } from "@/server/models/ContentItem";
import { readingSets } from "@/content/reading";
import { listeningSets } from "@/content/listening";
import { writingTasks } from "@/content/writing";
import { speakingSets } from "@/content/speaking";
import { MODULE_LABELS } from "@/lib/modules";
import { Card, Chip, EmptyState, PageHeader } from "@/components/ui";
import { AdminNav, StatusPill, formatDateTime } from "@/components/admin/AdminNav";
import { NewContentPanel } from "@/components/admin/ContentForms";

export const metadata: Metadata = { title: "Admin · Content", robots: { index: false } };

export default async function AdminContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireAdminPage();
  const params = await searchParams;
  const kind = (CONTENT_KINDS as readonly string[]).includes(String(params.kind)) ? (params.kind as ContentKind) : undefined;
  const status = (CONTENT_STATUSES as readonly string[]).includes(String(params.status)) ? (params.status as ContentStatus) : undefined;
  const items = await listContent({ kind, status });
  const builtIn = {
    reading: readingSets.map((s) => ({ id: s.id, title: s.title })),
    listening: listeningSets.map((s) => ({ id: s.id, title: `Part ${s.section}: ${s.title}` })),
    writing: writingTasks.map((t) => ({ id: t.id, title: `Task ${t.task}: ${t.title}` })),
    speaking: speakingSets.map((s) => ({ id: s.id, title: s.title })),
  };
  const href = (next: { kind?: string; status?: string }) => {
    const query = new URLSearchParams();
    const k = "kind" in next ? next.kind : kind;
    const s = "status" in next ? next.status : status;
    if (k) query.set("kind", k);
    if (s) query.set("status", s);
    const qs = query.toString();
    return `/admin/content${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Practice content"
        description="Create new tests with AI or from a copy of a built-in set, review and edit them, then publish. Published tests appear for students immediately and are used in mock tests."
      />
      <AdminNav active="/admin/content" />

      <NewContentPanel builtIn={builtIn} />

      <div className="flex flex-wrap items-center gap-2">
        <Chip href={href({ kind: undefined })} active={!kind}>All types</Chip>
        {CONTENT_KINDS.map((k) => (
          <Chip key={k} href={href({ kind: k })} active={kind === k}>{MODULE_LABELS[k]}</Chip>
        ))}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Chip href={href({ status: undefined })} active={!status}>Any status</Chip>
        {CONTENT_STATUSES.filter((s) => s !== "archived").map((s) => (
          <Chip key={s} href={href({ status: s })} active={status === s}><span className="capitalize">{s}</span></Chip>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No content yet" description="Create a draft above. Built-in tests are always available and are not listed here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/content/${item.id}`} className="font-medium text-accent-text hover:underline">{item.title}</Link>
                    <p className="text-xs text-ink-faint">{item.slug}</p>
                  </td>
                  <td className="px-4 py-3">{MODULE_LABELS[item.kind]}</td>
                  <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                  <td className="px-4 py-3 capitalize">{item.source === "ai" ? "AI draft" : item.source}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDateTime(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
