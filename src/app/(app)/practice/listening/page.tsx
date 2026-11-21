import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getBestScores } from "@/server/services/best-scores";
import { listListening } from "@/server/content/catalog";
import { allQuestions } from "@/content/types";
import { PageHeader } from "@/components/ui";
import { FullTestBanner, SetList } from "@/components/practice/SetList";
import { fullListeningSets } from "@/content/tests";

export const metadata: Metadata = { title: "Listening practice" };

export default async function ListeningIndexPage() {
  const user = await requirePageUser("/practice/listening");
  const [best, listeningSets] = await Promise.all([getBestScores(user.id, "listening"), listListening()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Listening"
        title="Listening"
        description="Read the questions first, then play the recording. In exam mode it plays once, just like the real test. The transcript is shown after you submit."
      />
      <FullTestBanner
        href="/practice/listening/full"
        title="Full Listening test"
        description="Every part back to back. The recording plays once, then you get 2 minutes to check your answers."
        meta={`${fullListeningSets().length} parts · ${fullListeningSets().reduce((n, set) => n + allQuestions(set.groups).length, 0)} questions`}
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
