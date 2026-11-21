import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";
import { getWritingTask, writingTasks } from "@/content/writing";
import { findWriting } from "@/server/content/catalog";
import type { WritingTask } from "@/content/types";
import { FULL_TEST_ID } from "@/content/tests";
import { WritingTest } from "@/components/cbt/WritingTest";

function pick(id: unknown, task: 1 | 2): WritingTask {
  const found = typeof id === "string" ? getWritingTask(id) : undefined;
  return found && found.task === task ? found : writingTasks.find((t) => t.task === task)!;
}

export async function generateMetadata({ params }: PageProps<"/practice/writing/[taskId]">): Promise<Metadata> {
  const { taskId } = await params;
  if (taskId === FULL_TEST_ID) return { title: "Full Writing test" };
  const task = getWritingTask(taskId);
  const found = task ?? (await findWriting(taskId));
  return { title: found ? `Writing Task ${found.task}: ${found.title}` : "Writing" };
}

export default async function WritingTaskPage({ params, searchParams }: PageProps<"/practice/writing/[taskId]">) {
  const { taskId } = await params;
  const query = await searchParams;
  const full = taskId === FULL_TEST_ID;
  const tasks = full ? [pick(query.t1, 1), pick(query.t2, 2)] : [await findWriting(taskId)].filter((t): t is WritingTask => Boolean(t));
  if (tasks.length === 0) notFound();
  const user = await requirePageUser(`/practice/writing/${taskId}`);
  const usage = await getUsageSummary(user.id, user.plan);

  return (
    <WritingTest
      tasks={tasks}
      title={full ? "Academic Writing · Full test" : `Writing Task ${tasks[0].task} · ${tasks[0].title}`}
      storageKey={`ielts:cbt:writing:${tasks.map((t) => t.id).join("+")}`}
      exitHref="/practice/writing"
      remainingEvaluations={usage.features.writing.remaining}
    />
  );
}
