import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReadingSet } from "@/content/reading";
import { allQuestions } from "@/content/types";
import { Card, PageHeader } from "@/components/ui";
import { QuestionSetRunner } from "@/components/practice/QuestionSetRunner";

export async function generateMetadata({ params }: PageProps<"/practice/reading/[setId]">): Promise<Metadata> {
  const set = getReadingSet((await params).setId);
  return { title: set ? `Reading: ${set.title}` : "Reading" };
}

export default async function ReadingSetPage({ params }: PageProps<"/practice/reading/[setId]">) {
  const set = getReadingSet((await params).setId);
  if (!set) notFound();

  return (
    <div className="space-y-6">
      <Link href="/practice/reading" className="text-sm text-zinc-500 hover:underline">← All reading sets</Link>
      <PageHeader
        eyebrow="Academic Reading"
        title={set.title}
        description={`${allQuestions(set.groups).length} questions. You should spend about ${set.recommendedMinutes} minutes on this passage.`}
      />
      <QuestionSetRunner
        module="reading"
        setId={set.id}
        groups={set.groups}
        layout="split"
        aside={
          <Card className="p-6">
            <h2 className="text-lg font-semibold">{set.passage.heading}</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-zinc-800 dark:text-zinc-200">
              {set.passage.paragraphs.map((paragraph) => (
                <p key={paragraph.label}>
                  <span className="mr-2 font-semibold text-emerald-700 dark:text-emerald-400">{paragraph.label}</span>
                  {paragraph.text}
                </p>
              ))}
            </div>
          </Card>
        }
      />
    </div>
  );
}
