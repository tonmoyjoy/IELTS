import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";
import { listMocks, MOCK_AI_NEEDS } from "@/server/services/mock";
import { MODULE_LABELS } from "@/lib/modules";
import { MOCK_SECTION_SECONDS } from "@/lib/mock";
import { BandBadge, Card, PageHeader } from "@/components/ui";
import { StartMockButton } from "@/components/mock/MockClient";

export const metadata: Metadata = { title: "Full mock test" };

export default async function MockIndexPage() {
  const user = await requirePageUser("/practice/mock");
  const [mocks, usage] = await Promise.all([listMocks(user.id), getUsageSummary(user.id, user.plan)]);
  const enough = usage.features.writing.remaining >= MOCK_AI_NEEDS.writing && usage.features.speaking.remaining >= MOCK_AI_NEEDS.speaking;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mock test"
        title="Full IELTS mock test"
        description="All four skills in one sitting, in the real order and on computer-test screens, with an overall band at the end."
      />
      <Card className="space-y-4 p-6">
        <ol className="grid gap-3 sm:grid-cols-4">
          {(["listening", "reading", "writing", "speaking"] as const).map((section, index) => (
            <li key={section} className="rounded-xl border border-line bg-sunken p-4">
              <p className="text-xs text-ink-faint">Section {index + 1}</p>
              <p className="font-semibold">{MODULE_LABELS[section]}</p>
              <p className="mt-1 text-xs text-ink-soft">up to {MOCK_SECTION_SECONDS[section] / 60} min</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-ink-soft">
          Allow about 2 hours 45 minutes. Each section has a fixed time kept by the server, so reloading the page doesn&apos;t reset it. You can take a break between sections.
          The test uses {MOCK_AI_NEEDS.writing} writing and {MOCK_AI_NEEDS.speaking} speaking evaluations.
        </p>
        <StartMockButton />
        {!enough && <p className="text-xs text-warn">You may not have enough AI evaluations left today. They reset at 00:00 UTC.</p>}
      </Card>

      {mocks.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Your mock tests</h2>
          <div className="grid gap-3">
            {mocks.map((mock) => (
              <Link key={mock.id} href={`/practice/mock/${mock.id}`} className="group">
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 group-hover:shadow-md">
                  <div>
                    <p className="font-medium">{new Date(mock.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-xs text-ink-faint">
                      {mock.status === "completed" ? "Completed" : `In progress · next: ${mock.section === "done" ? "results" : MODULE_LABELS[mock.section]}`}
                    </p>
                  </div>
                  {mock.overall != null ? <BandBadge score={mock.overall} /> : <span className="text-sm font-medium text-accent-text">Continue →</span>}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
