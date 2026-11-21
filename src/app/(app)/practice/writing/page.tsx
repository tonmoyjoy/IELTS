import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getBestScores } from "@/server/services/best-scores";
import { writingTasks as builtInTasks } from "@/content/writing";
import { listWriting } from "@/server/content/catalog";
import { PageHeader } from "@/components/ui";
import { FullTestBanner, SetList } from "@/components/practice/SetList";

export const metadata: Metadata = { title: "Writing practice" };

/** A different pair of tasks each visit for the full test. */
function randomTask(task: 1 | 2): string {
  const pool = builtInTasks.filter((t) => t.task === task);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export default async function WritingIndexPage() {
  const user = await requirePageUser("/practice/writing");
  const [best, writingTasks] = await Promise.all([getBestScores(user.id, "writing"), listWriting()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Writing"
        title="Academic Writing"
        description="Timed Task 1 and Task 2 practice, scored on the four official criteria with specific feedback you can act on."
      />
      <FullTestBanner
        href={`/practice/writing/full?t1=${randomTask(1)}&t2=${randomTask(2)}`}
        title="Full Writing test"
        description="Task 1 and Task 2 in one 60-minute sitting, with a combined Writing band."
        meta="2 tasks · 60 min"
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
