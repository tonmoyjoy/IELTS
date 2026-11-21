import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/session";
import { getAttempt, listAttempts, type AttemptDetail } from "@/server/services/attempts";
import { findListening, findReading } from "@/server/content/catalog";
import { allQuestions } from "@/content/types";
import { BandBadge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { CriteriaTable, FeedbackLists } from "@/components/practice/CriteriaTable";
import { WritingDiff } from "@/components/history/WritingDiff";
import { MODULE_LABELS } from "@/lib/modules";

export const metadata: Metadata = { title: "Attempt" };

type Graded = { id: string; number: number; given: string; correct: boolean; expected: string; explanation: string; overWordLimit?: boolean };

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "number")) as Record<string, number>;
}

async function ObjectiveResults({ attempt }: { attempt: AttemptDetail }) {
  const results = (Array.isArray(attempt.details.results) ? attempt.details.results : []) as Graded[];
  const set = attempt.module === "reading" ? await findReading(attempt.contentId) : await findListening(attempt.contentId);
  const prompts = new Map(set ? allQuestions(set.groups).map((q) => [q.id, q.prompt]) : []);
  const practiceHref = `/practice/${attempt.module}/${attempt.contentId}`;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Answers</h2>
        {set && <ButtonLink href={practiceHref} variant="secondary">Try this set again</ButtonLink>}
      </div>
      <ol className="mt-4 divide-y divide-line">
        {results.map((result) => (
          <li key={result.id} className="py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">
                <span className="mr-2 tabular-nums text-ink-faint">{result.number}.</span>
                {prompts.get(result.id) ?? result.id}
              </p>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${result.correct ? "bg-good-soft text-accent-text" : "bg-bad-soft text-bad"}`}>
                {result.correct ? "Correct" : "Incorrect"}
              </span>
            </div>
            <p className="mt-1 text-ink-soft">
              Your answer: <span className="font-medium text-ink">{result.given || "—"}</span>
              {!result.correct && <> · Correct: <span className="font-medium text-ink">{result.expected}</span></>}
              {result.overWordLimit && " · over the word limit"}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">{result.explanation}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

async function WritingResult({ attempt, userId, compareId }: { attempt: AttemptDetail; userId: string; compareId?: string }) {
  const criteria = asNumberRecord(attempt.details.criteria);
  const answer = typeof attempt.details.answer === "string" ? attempt.details.answer : "";
  const isTask1 = attempt.contentId.startsWith("task1");
  const siblings = (await listAttempts(userId, { module: "writing", contentId: attempt.contentId, limit: 20 })).attempts.filter(
    (a) => a.id !== attempt.id
  );
  const compare = compareId ? await getAttempt(userId, compareId) : null;
  const compareAnswer = compare && compare.contentId === attempt.contentId && typeof compare.details.answer === "string" ? compare.details.answer : null;

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-6">
        {attempt.summary && <p className="text-sm leading-6 text-ink-soft">{attempt.summary}</p>}
        <CriteriaTable
          rows={[
            { label: isTask1 ? "Task Achievement" : "Task Response", score: criteria.taskResponse ?? 0 },
            { label: "Coherence and Cohesion", score: criteria.coherenceCohesion ?? 0 },
            { label: "Lexical Resource", score: criteria.lexicalResource ?? 0 },
            { label: "Grammatical Range and Accuracy", score: criteria.grammaticalRange ?? 0 },
          ]}
        />
        <FeedbackLists strengths={asStringArray(attempt.details.strengths)} improvements={asStringArray(attempt.details.improvements)} />
        <ButtonLink href={`/practice/writing/${attempt.contentId}`} variant="secondary">Write this task again</ButtonLink>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{compareAnswer ? "Changes from your earlier attempt" : "Your answer"}</h2>
          {typeof attempt.details.wordCount === "number" && <span className="text-xs text-ink-faint">{attempt.details.wordCount} words</span>}
        </div>
        {compareAnswer ? (
          <div className="mt-3"><WritingDiff before={compareAnswer} after={answer} /></div>
        ) : (
          <p className="prose-reading mt-3 whitespace-pre-wrap">{answer}</p>
        )}
        {siblings.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm font-medium">Compare with another attempt at this task</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {compareAnswer && (
                <li><Link href={`/history/${attempt.id}`} className="rounded-md border border-line-strong px-2.5 py-1 text-xs hover:bg-sunken">Hide comparison</Link></li>
              )}
              {siblings.map((sibling) => (
                <li key={sibling.id}>
                  <Link
                    href={`/history/${attempt.id}?compare=${sibling.id}`}
                    aria-current={sibling.id === compareId ? "true" : undefined}
                    className={`rounded-md border px-2.5 py-1 text-xs ${sibling.id === compareId ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-sunken"}`}
                  >
                    {new Date(sibling.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · Band {sibling.score}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function SpeakingResult({ attempt }: { attempt: AttemptDetail }) {
  const criteria = asNumberRecord(attempt.details.criteria);
  const transcript = typeof attempt.details.transcript === "string" ? attempt.details.transcript : "";
  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-6">
        {attempt.summary && <p className="text-sm leading-6 text-ink-soft">{attempt.summary}</p>}
        <CriteriaTable
          rows={[
            { label: "Fluency and Coherence", score: criteria.fluencyCoherence ?? 0 },
            { label: "Lexical Resource", score: criteria.lexicalResource ?? 0 },
            { label: "Grammatical Range and Accuracy", score: criteria.grammaticalRange ?? 0 },
            { label: "Pronunciation", score: criteria.pronunciation ?? 0 },
          ]}
        />
        <FeedbackLists strengths={asStringArray(attempt.details.strengths)} improvements={asStringArray(attempt.details.improvements)} />
      </Card>
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Transcript</h2>
          {typeof attempt.details.durationSeconds === "number" && (
            <span className="text-xs text-ink-faint">{attempt.details.durationSeconds} seconds</span>
          )}
        </div>
        <p className="prose-reading mt-3 whitespace-pre-wrap">{transcript}</p>
      </Card>
    </div>
  );
}

export default async function AttemptPage({ params, searchParams }: PageProps<"/history/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requirePageUser(`/history/${id}`);
  const attempt = await getAttempt(user.id, id);
  if (!attempt) notFound();
  const compareId = typeof query.compare === "string" ? query.compare : undefined;

  return (
    <div className="space-y-6">
      <Link href={`/history?module=${attempt.module}`} className="text-sm text-ink-faint hover:underline">
        ← {MODULE_LABELS[attempt.module]} history
      </Link>
      <PageHeader
        eyebrow={MODULE_LABELS[attempt.module]}
        title={attempt.title}
        description={`${new Date(attempt.date).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}${
          attempt.totalQuestions ? ` · ${attempt.rawScore}/${attempt.totalQuestions} correct (estimated band)` : ""
        }`}
        actions={<BandBadge score={attempt.score} size="lg" />}
      />
      {attempt.module === "reading" || attempt.module === "listening" ? (
        <ObjectiveResults attempt={attempt} />
      ) : attempt.module === "writing" ? (
        <WritingResult attempt={attempt} userId={user.id} compareId={compareId} />
      ) : (
        <SpeakingResult attempt={attempt} />
      )}
    </div>
  );
}
