import type { ListeningSet, ReadingSet } from "@/content/types";
import { allQuestions } from "@/content/types";
import { getReadingSet, readingSets } from "@/content/reading";
import { getListeningSet, listeningSets } from "@/content/listening";

/** One passage or recording inside a computer-delivered test (client-safe, no answers). */
export type TestPartSpec = {
  setId: string;
  title: string;
  label: string;
  offset: number;
  groups: ReadingSet["groups"];
  passage?: ReadingSet["passage"];
  audioSrc?: string;
};

export const FULL_TEST_ID = "full";

export function readingParts(sets: ReadingSet[]): TestPartSpec[] {
  let offset = 0;
  return sets.map((set, index) => {
    const part = { setId: set.id, title: set.title, label: `Passage ${index + 1}`, offset, groups: set.groups, passage: set.passage };
    offset += allQuestions(set.groups).length;
    return part;
  });
}

export function listeningParts(sets: ListeningSet[]): TestPartSpec[] {
  let offset = 0;
  return sets.map((set, index) => {
    const part = { setId: set.id, title: set.title, label: `Part ${index + 1}`, offset, groups: set.groups, audioSrc: set.audioSrc };
    offset += allQuestions(set.groups).length;
    return part;
  });
}

/** All listening sets in exam order (section 1 first). */
export function fullListeningSets(): ListeningSet[] {
  return [...listeningSets].sort((a, b) => a.section - b.section);
}

export function fullReadingSets(): ReadingSet[] {
  return readingSets;
}

export function readingTimeLimitSeconds(sets: ReadingSet[]): number {
  return sets.reduce((sum, set) => sum + set.recommendedMinutes, 0) * 60;
}

export function resolveReadingSets(id: string): ReadingSet[] | null {
  if (id === FULL_TEST_ID) return fullReadingSets();
  const set = getReadingSet(id);
  return set ? [set] : null;
}

export function resolveListeningSets(id: string): ListeningSet[] | null {
  if (id === FULL_TEST_ID) return fullListeningSets();
  const set = getListeningSet(id);
  return set ? [set] : null;
}
