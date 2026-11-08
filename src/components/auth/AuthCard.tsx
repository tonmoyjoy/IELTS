import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app/Logo";

export function AuthCard({ title, description, children, footer }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="IELTS Practice Studio home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-lift sm:p-10">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-7 text-ink-soft">{description}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
    </main>
  );
}
