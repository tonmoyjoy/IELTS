import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <div className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          AI IELTS Practice
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Prepare for every IELTS module
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Practice speaking, writing, reading, and listening with guided IELTS-style tasks,
          instant scoring, progress analytics, and Gemini-powered feedback.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <span className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-900">Speaking interviews</span>
          <span className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-900">Writing feedback</span>
          <span className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-900">Reading drills</span>
          <span className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-900">Listening practice</span>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
