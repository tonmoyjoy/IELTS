import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getBestScores } from "@/server/services/best-scores";
import { writingTasks } from "@/content/writing";
import { PageHeader } from "@/components/ui";
import { SetList } from "@/components/practice/SetList";

export const metadata: Metadata = { title: "Writing practice" };

export default async function WritingIndexPage() {
  const user = await requirePageUser("/practice/writing");
  const best = await getBestScores(user.id, "writing");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Writing"
        title="Academic Writing"
        description="Timed Task 1 and Task 2 practice, scored on the four official criteria with specific feedback you can act on."
      />
      <SetList
        items={writingTasks.map((task) => ({
          href: `/practice/writing/${task.id}`,
          title: `Task ${task.task}: ${task.title}`,
          summary: task.prompt,
          meta: `${task.minutes} minutes · at least ${task.minWords} words`,
          best: best.get(task.id) ?? null,
        }))}
      />
    </div>
  );
}
