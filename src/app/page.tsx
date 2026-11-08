import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { Logo } from "@/components/app/Logo";
import { ComfortMenu } from "@/components/app/ComfortMenu";
import { BILLING_OPTIONS, PLANS, formatBdt } from "@/lib/plans";

const MODULES = [
  {
    title: "Listening",
    body: "Exam-style recordings that play once, just like test day. Marked instantly, then the transcript and an explanation for every answer.",
  },
  {
    title: "Reading",
    body: "Academic passages in a calm reading view with True/False/Not Given, matching and completion questions, converted to an estimated band.",
  },
  {
    title: "Writing",
    body: "Task 1 charts and processes and Task 2 essays under timed conditions, scored on all four official criteria with specific advice.",
  },
  {
    title: "Speaking",
    body: "Real cue cards and a timed Part 1–3 run-through. Your recording is assessed from the audio, so pronunciation is judged on how you sound.",
  },
];

const COMFORT = [
  { title: "Gentle on the eyes", body: "Warm sepia paper tones and a matching night mode — no harsh white glare." },
  { title: "Comfortable reading", body: "A serif reading face, generous spacing and adjustable text size." },
  { title: "Built-in rest breaks", body: "Optional 20-20-20 reminders keep long study sessions sustainable." },
];

export default async function HomePage() {
  // The marketing page must render even if the database is briefly unavailable.
  const user = await getSessionUser().catch(() => null);
  const free = PLANS.free.dailyLimits;
  const pro = PLANS.pro.dailyLimits;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="IELTS Practice Studio home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1.5">
            <ComfortMenu />
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
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:pt-28">
          <Eyebrow>Academic IELTS preparation</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl">
            Know your band before test day.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
            Practise all four modules under exam conditions, in a calm space designed for long study sessions.
            Listening and Reading are marked against the answer key; Writing and Speaking get criterion-by-criterion
            feedback from an AI examiner.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/dashboard" : "/register"} className="px-6 py-3 text-base">
              {user ? "Continue practising" : "Create a free account"}
            </ButtonLink>
            {!user && (
              <ButtonLink href="#pricing" variant="secondary" className="px-6 py-3 text-base">
                See pricing
              </ButtonLink>
            )}
          </div>
        </section>

        <section aria-label="Modules" className="mx-auto grid max-w-6xl gap-5 px-4 pb-20 sm:grid-cols-2">
          {MODULES.map((module, index) => (
            <Card key={module.title} className="p-7">
              <p className="font-serif text-sm text-accent-text">0{index + 1}</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-ink">{module.title}</h2>
              <p className="mt-2.5 text-[15px] leading-7 text-ink-soft">{module.body}</p>
            </Card>
          ))}
        </section>

        <section className="border-y border-line bg-sunken/60 py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-3">
            {COMFORT.map((item) => (
              <div key={item.title}>
                <h3 className="font-serif text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Start free. Go Pro when you&apos;re ready.</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-soft">
              Pay once with bKash, Nagad, Rocket or card. No automatic renewals.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            <Card className="flex flex-col p-7">
              <h3 className="font-serif text-xl font-semibold">Free</h3>
              <p className="mt-3 font-serif text-4xl font-semibold">৳0</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm leading-6 text-ink-soft">
                <li>Unlimited Listening and Reading</li>
                <li>{free.writing} Writing evaluations a day</li>
                <li>{free.speaking} Speaking evaluations a day</li>
                <li>Full history and progress tracking</li>
              </ul>
              <ButtonLink href={user ? "/dashboard" : "/register"} variant="secondary" className="mt-7">
                {user ? "Your dashboard" : "Start free"}
              </ButtonLink>
            </Card>
            {BILLING_OPTIONS.map((option) => {
              const featured = option.id === "pro-3m";
              return (
                <Card key={option.id} className={`relative flex flex-col p-7 ${featured ? "border-accent ring-1 ring-accent" : ""}`}>
                  {option.note && (
                    <span className="absolute -top-3 left-7 rounded-full bg-accent-btn px-3 py-1 text-xs font-semibold text-on-accent">
                      {option.note}
                    </span>
                  )}
                  <h3 className="font-serif text-xl font-semibold">Pro · {option.label}</h3>
                  <p className="mt-3 font-serif text-4xl font-semibold">{formatBdt(option.amountBdt)}</p>
                  <p className="text-sm text-ink-faint">
                    {option.days > 30 ? `≈ ${formatBdt(Math.round(option.amountBdt / (option.days / 30)))} per month` : "Billed once"}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm leading-6 text-ink-soft">
                    <li>Everything in Free</li>
                    <li>{pro.writing} Writing evaluations a day</li>
                    <li>{pro.speaking} Speaking evaluations a day</li>
                    <li>{option.days} days of Pro</li>
                  </ul>
                  <ButtonLink
                    href={user ? `/billing?plan=${option.id}` : `/register`}
                    variant={featured ? "primary" : "secondary"}
                    className="mt-7"
                  >
                    {user ? "Choose plan" : "Create account"}
                  </ButtonLink>
                </Card>
              );
            })}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-5 text-ink-faint">
            Scores are practice estimates to guide your preparation. They are not official IELTS results, and this
            service is not affiliated with or endorsed by the IELTS partners.
          </p>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} IELTS Practice Studio
      </footer>
    </div>
  );
}
