import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findReading } from "@/server/content/catalog";
import { FULL_TEST_ID, readingParts, readingTimeLimitSeconds, resolveReadingSets } from "@/content/tests";
import { ObjectiveTest } from "@/components/cbt/ObjectiveTest";

async function setsFor(setId: string) {
  if (setId === FULL_TEST_ID) return resolveReadingSets(setId);
  const set = await findReading(setId);
  return set ? [set] : null;
}

export async function generateMetadata({ params }: PageProps<"/practice/reading/[setId]">): Promise<Metadata> {
  const { setId } = await params;
  const sets = await setsFor(setId);
  return { title: !sets ? "Reading" : setId === FULL_TEST_ID ? "Full Reading test" : `Reading: ${sets[0].title}` };
}

export default async function ReadingTestPage({ params }: PageProps<"/practice/reading/[setId]">) {
  const { setId } = await params;
  const sets = await setsFor(setId);
  if (!sets) notFound();
  const full = setId === FULL_TEST_ID;

  return (
    <ObjectiveTest
      module="reading"
      title={full ? "Academic Reading · Full test" : `Academic Reading · ${sets[0].title}`}
      parts={readingParts(sets)}
      timeLimitSeconds={readingTimeLimitSeconds(sets)}
      storageKey={`ielts:cbt:reading:${setId}`}
      exitHref="/practice/reading"
    />
  );
}
