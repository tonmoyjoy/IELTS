import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";
import { getSpeakingSet, speakingSets } from "@/content/speaking";
import { PageHeader } from "@/components/ui";
import { SpeakingStudio } from "@/components/practice/SpeakingStudio";

export const metadata: Metadata = { title: "Speaking practice" };

export default async function SpeakingPage({ searchParams }: PageProps<"/practice/speaking">) {
  const user = await requirePageUser("/practice/speaking");
  const params = await searchParams;
  const requested = typeof params.set === "string" ? getSpeakingSet(params.set) : undefined;
  const active = requested ?? speakingSets[0];
  const usage = await getUsageSummary(user.id, user.plan);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Speaking"
        title="Speaking"
        description="Pick a topic, run the timed simulation to rehearse, then record an answer for a scored assessment of fluency, vocabulary, grammar and pronunciation."
      />
      <SpeakingStudio sets={speakingSets} active={active} remainingEvaluations={usage.features.speaking.remaining} />
    </div>
  );
}
