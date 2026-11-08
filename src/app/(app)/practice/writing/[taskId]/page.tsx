import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";
import { getWritingTask } from "@/content/writing";
import { Card, PageHeader } from "@/components/ui";
import { TaskVisual } from "@/components/practice/TaskVisual";
import { WritingEditor } from "@/components/practice/WritingEditor";

export async function generateMetadata({ params }: PageProps<"/practice/writing/[taskId]">): Promise<Metadata> {
  const task = getWritingTask((await params).taskId);
  return { title: task ? `Writing Task ${task.task}: ${task.title}` : "Writing" };
}

export default async function WritingTaskPage({ params }: PageProps<"/practice/writing/[taskId]">) {
  const { taskId } = await params;
  const task = getWritingTask(taskId);
  if (!task) notFound();
  const user = await requirePageUser(`/practice/writing/${taskId}`);
  const usage = await getUsageSummary(user.id, user.plan);

  return (
    <div className="space-y-6">
      <Link href="/practice/writing" className="text-sm text-ink-faint hover:underline">← All writing tasks</Link>
      <PageHeader eyebrow={`Writing Task ${task.task}`} title={task.title} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <p className="text-sm font-semibold">You should spend about {task.minutes} minutes on this task.</p>
          <div className="prose-reading rounded-xl border border-line bg-sunken p-5">
            <p>{task.prompt}</p>
            {task.question && <p className="mt-3 font-semibold">{task.question}</p>}
            {task.task === 2 && (
              <p className="mt-3 text-sm text-ink-soft">
                Give reasons for your answer and include any relevant examples from your own knowledge or experience.
              </p>
            )}
          </div>
          <p className="text-sm font-semibold">Write at least {task.minWords} words.</p>
          {task.visual && (
            <div className="rounded-lg border border-line p-4">
              <TaskVisual visual={task.visual} />
            </div>
          )}
        </Card>
        <WritingEditor
          taskId={task.id}
          taskNumber={task.task}
          minutes={task.minutes}
          minWords={task.minWords}
          remainingEvaluations={usage.features.writing.remaining}
        />
      </div>
    </div>
  );
}
