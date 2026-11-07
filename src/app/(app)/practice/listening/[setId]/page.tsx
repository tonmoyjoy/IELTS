import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListeningSet } from "@/content/listening";
import { allQuestions } from "@/content/types";
import { PageHeader } from "@/components/ui";
import { QuestionSetRunner } from "@/components/practice/QuestionSetRunner";
import { ListeningPlayer } from "@/components/practice/ListeningPlayer";

export async function generateMetadata({ params }: PageProps<"/practice/listening/[setId]">): Promise<Metadata> {
  const set = getListeningSet((await params).setId);
  return { title: set ? `Listening: ${set.title}` : "Listening" };
}

export default async function ListeningSetPage({ params }: PageProps<"/practice/listening/[setId]">) {
  const set = getListeningSet((await params).setId);
  if (!set) notFound();

  return (
    <div className="space-y-6">
      <Link href="/practice/listening" className="text-sm text-zinc-500 hover:underline">← All listening sets</Link>
      <PageHeader
        eyebrow={`Listening · Section ${set.section}`}
        title={set.title}
        description={`${allQuestions(set.groups).length} questions. Take a moment to read the questions before you press play.`}
      />
      <QuestionSetRunner module="listening" setId={set.id} groups={set.groups} layout="stacked" aside={<ListeningPlayer src={set.audioSrc} />} />
    </div>
  );
}
