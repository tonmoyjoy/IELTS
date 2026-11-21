import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/session";
import { getContent } from "@/server/services/content-admin";
import { ApiError } from "@/server/http/api";
import { notFound } from "next/navigation";
import { MODULE_LABELS } from "@/lib/modules";
import { PageHeader } from "@/components/ui";
import { AdminNav } from "@/components/admin/AdminNav";
import { ContentEditor } from "@/components/admin/ContentEditor";

export const metadata: Metadata = { title: "Admin · Edit content", robots: { index: false } };

export default async function AdminContentItemPage({ params }: PageProps<"/admin/content/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  const item = await getContent(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const practiceHref = `/practice/${item.kind}${item.kind === "speaking" ? `?set=${item.slug}` : `/${item.slug}`}`;

  return (
    <div className="space-y-6">
      <Link href="/admin/content" className="text-sm text-ink-faint hover:underline">← All content</Link>
      <PageHeader eyebrow={`Admin · ${MODULE_LABELS[item.kind]}`} title={item.title} description={item.brief ? `Brief: ${item.brief}` : undefined} />
      <AdminNav active="/admin/content" />
      <ContentEditor item={item} practiceHref={practiceHref} />
    </div>
  );
}
