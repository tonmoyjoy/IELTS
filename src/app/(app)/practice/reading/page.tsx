import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getBestScores } from "@/server/services/best-scores";
import { listReading } from "@/server/content/catalog";
import { allQuestions } from "@/content/types";
import { PageHeader } from "@/components/ui";
import { FullTestBanner, SetList } from "@/components/practice/SetList";
import { fullReadingSets, readingTimeLimitSeconds } from "@/content/tests";

export const metadata: Metadata = { title: "Reading practice" };

export default async function ReadingIndexPage() {
  const user = await requirePageUser("/practice/reading");
  const [best, readingSets] = await Promise.all([getBestScores(user.id, "reading"), listReading()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reading"
        title="Academic Reading"
        description="Each passage mirrors one section of the Academic test. Answers are marked against the key and every answer comes with an explanation."
      />
      <FullTestBanner
        href="/practice/reading/full"
        title="Full Reading test"
        description="All passages in one timed sitting, with highlighting, flags and a question navigator."
        meta={`${fullReadingSets().reduce((n, set) => n + allQuestions(set.groups).length, 0)} questions · ${readingTimeLimitSeconds(fullReadingSets()) / 60} min`}
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
