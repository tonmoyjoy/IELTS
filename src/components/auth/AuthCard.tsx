import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-sm font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
        IELTS Practice Studio
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">{footer}</div>}
    </main>
  );
}
