import { BandBadge, ButtonLink, Card } from "@/components/ui";
import { CriteriaTable, FeedbackLists } from "@/components/practice/CriteriaTable";
import type { SpeakingResultPayload } from "@/lib/speaking-upload";

export function SpeakingFeedback({ result }: { result: SpeakingResultPayload }) {
  const { evaluation } = result;
  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Examiner feedback</h2>
        <BandBadge score={evaluation.bandScore} size="lg" />
      </div>
      <p className="text-sm leading-6 text-ink-soft">{evaluation.summary}</p>
      <CriteriaTable
        rows={[
          { label: "Fluency and Coherence", score: evaluation.criteria.fluencyCoherence },
          { label: "Lexical Resource", score: evaluation.criteria.lexicalResource },
          { label: "Grammatical Range and Accuracy", score: evaluation.criteria.grammaticalRange },
          { label: "Pronunciation", score: evaluation.criteria.pronunciation },
        ]}
      />
      <FeedbackLists strengths={evaluation.strengths} improvements={evaluation.improvements} />
      <details>
        <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
        <p className="prose-reading mt-2 whitespace-pre-wrap">{evaluation.transcript}</p>
      </details>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <ButtonLink href={`/history/${result.attempt.id}`} variant="secondary">Open in history</ButtonLink>
      </div>
      <p className="text-xs text-ink-faint">AI feedback is a practice estimate, not an official IELTS score.</p>
    </Card>
  );
}
