import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";
import { getMock, type MockView } from "@/server/services/mock";
import { examinerClips, findListening, findReading, findSpeaking, findWriting } from "@/server/content/catalog";
import { listeningParts, readingParts } from "@/content/tests";
import type { ListeningSet, ReadingSet, WritingTask } from "@/content/types";
import { MODULE_LABELS } from "@/lib/modules";
import { MOCK_ORDER, MOCK_SECTION_SECONDS } from "@/lib/mock";
import { Alert, BandBadge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { MockObjectiveSection, MockSpeakingSection, MockWritingSection, StartSectionButton } from "@/components/mock/MockClient";

export const metadata: Metadata = { title: "Mock test" };

const INSTRUCTIONS: Record<(typeof MOCK_ORDER)[number], string[]> = {
  listening: [
    "Four-part format with the recording played once only. Use headphones.",
    "You will have time to read the questions before each part, and 2 minutes at the end to check your answers.",
  ],
  reading: ["Three passages in 60 minutes. Highlight text and flag questions as you go.", "Your answers are submitted automatically when time runs out."],
  writing: ["Task 1 (about 20 minutes, 150 words) and Task 2 (about 40 minutes, 250 words) in 60 minutes.", "Task 2 counts twice as much as Task 1."],
  speaking: ["A talking examiner asks Part 1, Part 2 and Part 3 questions. About 12 minutes.", "Find a quiet room and use headphones."],
};

async function resolve<T>(ids: string[], get: (id: string) => Promise<T | undefined>): Promise<T[]> {
  const found: Array<T | undefined> = await Promise.all(ids.map(get));
  return found.filter((item): item is T => item !== undefined);
}

export default async function MockPage({ params }: PageProps<"/practice/mock/[id]">) {
  const { id } = await params;
  const user = await requirePageUser(`/practice/mock/${id}`);
  const mock = await getMock(user.id, id);
  if (!mock) notFound();

  if (mock.status === "completed" || mock.section === "done") return <MockReport mock={mock} />;

  const section = mock.section;
  const sectionNumber = MOCK_ORDER.indexOf(section) + 1;

  if (!mock.sectionStartedAt || !mock.deadline) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/practice/mock" className="text-sm text-ink-faint hover:underline">← All mock tests</Link>
        <PageHeader eyebrow={`Mock test · Section ${sectionNumber} of 4`} title={MODULE_LABELS[section]} />
        <Card className="space-y-4 p-6">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            {INSTRUCTIONS[section].map((line) => <li key={line}>{line}</li>)}
            <li>Time allowed: {MOCK_SECTION_SECONDS[section] / 60} minutes. The clock starts when you press Start and keeps running if you leave the page.</li>
          </ul>
          {sectionNumber > 1 && <Alert tone="info">Previous sections are saved. Take a short break if you need one: the clock only starts when you press Start.</Alert>}
          <StartSectionButton mockId={mock.id} label={`Start ${MODULE_LABELS[section]}`} />
        </Card>
      </div>
    );
  }

  if (section === "listening" || section === "reading") {
    const parts =
      section === "listening"
        ? listeningParts(await resolve<ListeningSet>(mock.listeningSetIds, findListening))
        : readingParts(await resolve<ReadingSet>(mock.readingSetIds, findReading));
    return <MockObjectiveSection mockId={mock.id} section={section} title={`Mock test · ${MODULE_LABELS[section]}`} parts={parts} deadline={mock.deadline} />;
  }

  const usage = await getUsageSummary(user.id, user.plan);
  if (section === "writing") {
    const tasks = await resolve<WritingTask>(mock.writingTaskIds, findWriting);
    return <MockWritingSection mockId={mock.id} tasks={tasks} deadline={mock.deadline} remaining={usage.features.writing.remaining} />;
  }

  const set = await findSpeaking(mock.speakingSetId);
  if (!set) notFound();
  return <MockSpeakingSection mockId={mock.id} set={set} clips={await examinerClips(set.id)} remaining={usage.features.speaking.remaining} />;
}

function MockReport({ mock }: { mock: MockView }) {
  return (
    <div className="space-y-6">
      <Link href="/practice/mock" className="text-sm text-ink-faint hover:underline">← All mock tests</Link>
      <PageHeader
        eyebrow="Mock test result"
        title="Your estimated overall band"
        description={mock.completedAt ? `Completed ${new Date(mock.completedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : undefined}
      />
      <Card className="flex flex-wrap items-center gap-6 p-6">
        <BandBadge score={mock.overall} size="lg" />
        <p className="max-w-xl text-sm text-ink-soft">
          The overall band is the average of the four section bands, rounded to the nearest half band (.25 rounds up to .5, .75 up to the next whole band). It is a practice estimate, not an official result.
        </p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_ORDER.map((section) => {
          const result = mock.results[section];
          return (
            <Card key={section} className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{MODULE_LABELS[section]}</h2>
                <BandBadge score={result?.band ?? null} />
              </div>
              {result?.rawScore != null && (
                <p className="text-sm text-ink-soft">
                  {result.rawScore} / {result.totalQuestions} correct
                </p>
              )}
              {section === "writing" && result && (
                <p className="text-sm text-ink-soft">Task 1: {result.task1 ?? 0} · Task 2: {result.task2 ?? 0}</p>
              )}
              {result?.late && <p className="text-xs text-warn">Submitted after the time limit.</p>}
              <div className="flex flex-wrap gap-x-3 text-xs">
                {result?.attemptIds.map((attemptId, index) => (
                  <Link key={attemptId} href={`/history/${attemptId}`} className="font-medium text-accent-text hover:underline">
                    {result.attemptIds.length > 1 && section !== "writing" ? `Part ${index + 1} details` : "Details"}
                  </Link>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      <ButtonLink href="/practice/mock" variant="secondary">Take another mock test</ButtonLink>
    </div>
  );
}
