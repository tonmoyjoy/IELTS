import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { ButtonLink, Card } from "@/components/ui";
import { PLANS } from "@/lib/plans";

const MODULES = [
  {
    title: "Listening",
    body: "Recorded IELTS-style sections with form, sentence and multiple-choice questions. Marked instantly, with the transcript and an explanation for every answer.",
  },
  {
    title: "Reading",
    body: "Academic passages with True/False/Not Given, Yes/No/Not Given, paragraph matching and completion tasks, converted to an estimated band.",
  },
  {
    title: "Writing",
    body: "Task 1 charts and processes and Task 2 essays under timed conditions. Scored on all four official criteria with specific, quotable feedback.",
  },
  {
    title: "Speaking",
    body: "Timed Part 1–3 practice with real cue cards. Your recording is assessed from the audio, so pronunciation and fluency are judged on how you actually sound.",
  },
];

export default async function HomePage() {
  // The marketing page must render even if the database is briefly unavailable.
  const user = await getSessionUser().catch(() => null);
  const free = PLANS.free.dailyLimits;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
            IELTS Practice Studio
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
                <ButtonLink href="/register">Start free</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Academic IELTS preparation
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
            Know your band before test day.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Practise all four modules under exam conditions. Listening and Reading are marked against the answer key;
            Writing and Speaking get criterion-by-criterion feedback from an AI examiner.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/dashboard" : "/register"} className="px-6 py-3 text-base">
              {user ? "Continue practising" : "Create a free account"}
            </ButtonLink>
            {!user && (
              <ButtonLink href="/login" variant="secondary" className="px-6 py-3 text-base">
                I already have an account
              </ButtonLink>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2">
          {MODULES.map((module) => (
            <Card key={module.title} className="p-6">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">{module.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{module.body}</p>
            </Card>
          ))}
        </section>

        <section className="border-t border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Free to start</h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              Unlimited Listening and Reading practice, plus {free.writing} Writing and {free.speaking} Speaking evaluations
              every day.
            </p>
            <p className="mx-auto mt-6 max-w-xl text-xs leading-5 text-zinc-500">
              Scores are practice estimates to guide your preparation. They are not official IELTS results, and this
              service is not affiliated with or endorsed by the IELTS partners.
            </p>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} IELTS Practice Studio
      </footer>
    </div>
  );
}
