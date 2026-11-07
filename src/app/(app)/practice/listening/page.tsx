import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getBestScores } from "@/server/services/best-scores";
import { listeningSets } from "@/content/listening";
import { allQuestions } from "@/content/types";
import { PageHeader } from "@/components/ui";
import { SetList } from "@/components/practice/SetList";

export const metadata: Metadata = { title: "Listening practice" };

export default async function ListeningIndexPage() {
  const user = await requirePageUser("/practice/listening");
  const best = await getBestScores(user.id, "listening");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Listening"
        title="Listening"
        description="Read the questions first, then play the recording. In exam mode it plays once, just like the real test. The transcript is shown after you submit."
      />
      <SetList
        items={listeningSets.map((set) => ({
          href: `/practice/listening/${set.id}`,
          title: set.title,
          summary: set.summary,
          meta: `Section ${set.section} · ${allQuestions(set.groups).length} questions`,
          best: best.get(set.id) ?? null,
        }))}
      />
    </div>
  );
}
