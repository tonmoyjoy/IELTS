import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getBestScores } from "@/server/services/best-scores";
import { readingSets } from "@/content/reading";
import { allQuestions } from "@/content/types";
import { PageHeader } from "@/components/ui";
import { SetList } from "@/components/practice/SetList";

export const metadata: Metadata = { title: "Reading practice" };

export default async function ReadingIndexPage() {
  const user = await requirePageUser("/practice/reading");
  const best = await getBestScores(user.id, "reading");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reading"
        title="Academic Reading"
        description="Each passage mirrors one section of the Academic test. Answers are marked against the key and every answer comes with an explanation."
      />
      <SetList
        items={readingSets.map((set) => ({
          href: `/practice/reading/${set.id}`,
          title: set.title,
          summary: set.summary,
          meta: `${allQuestions(set.groups).length} questions · about ${set.recommendedMinutes} minutes`,
          best: best.get(set.id) ?? null,
        }))}
      />
    </div>
  );
}
