import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";
import { examinerClips, findSpeaking, listSpeaking } from "@/server/content/catalog";
import { PageHeader } from "@/components/ui";
import { SpeakingStudio } from "@/components/practice/SpeakingStudio";
import { SpeakingExam } from "@/components/cbt/SpeakingExam";

export const metadata: Metadata = { title: "Speaking practice" };

export default async function SpeakingPage({ searchParams }: PageProps<"/practice/speaking">) {
  const user = await requirePageUser("/practice/speaking");
  const params = await searchParams;
  const speakingSets = await listSpeaking();
  const requested = typeof params.set === "string" ? await findSpeaking(params.set) : undefined;
  const active = requested ?? speakingSets[0];
  const usage = await getUsageSummary(user.id, user.plan);

  if (params.exam === "1") {
    return (
      <SpeakingExam
        key={active.id}
        set={active}
        clips={await examinerClips(active.id)}
        remainingEvaluations={usage.features.speaking.remaining}
        exitHref="/practice/speaking"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Speaking"
        title="Speaking"
        description="Take a full test with a talking examiner, or record a single answer for quick feedback on fluency, vocabulary, grammar and pronunciation."
      />
      <SpeakingStudio sets={speakingSets} active={active} remainingEvaluations={usage.features.speaking.remaining} />
    </div>
  );
}
