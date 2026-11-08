import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-accent-text">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-ink-soft">The page you were looking for doesn&apos;t exist or has moved.</p>
      <ButtonLink href="/dashboard" className="mt-6">Back to dashboard</ButtonLink>
    </main>
  );
}
