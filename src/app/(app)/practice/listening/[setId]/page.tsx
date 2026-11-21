import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findListening } from "@/server/content/catalog";
import { FULL_TEST_ID, listeningParts, resolveListeningSets } from "@/content/tests";
import { ObjectiveTest } from "@/components/cbt/ObjectiveTest";

async function setsFor(setId: string) {
  if (setId === FULL_TEST_ID) return resolveListeningSets(setId);
  const set = await findListening(setId);
  return set ? [set] : null;
}

export async function generateMetadata({ params }: PageProps<"/practice/listening/[setId]">): Promise<Metadata> {
  const { setId } = await params;
  const sets = await setsFor(setId);
  return { title: !sets ? "Listening" : setId === FULL_TEST_ID ? "Full Listening test" : `Listening: ${sets[0].title}` };
}

export default async function ListeningTestPage({ params }: PageProps<"/practice/listening/[setId]">) {
  const { setId } = await params;
  const sets = await setsFor(setId);
  if (!sets) notFound();
  const full = setId === FULL_TEST_ID;

  return (
    <ObjectiveTest
      module="listening"
      title={full ? "Listening · Full test" : `Listening · ${sets[0].title}`}
      parts={listeningParts(sets)}
      storageKey={`ielts:cbt:listening:${setId}`}
      exitHref="/practice/listening"
    />
  );
}
