import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "./LoginForm";
import { safeRedirectPath } from "@/lib/text";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue practising and review your feedback."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-accent-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm redirectTo={safeRedirectPath(from)} />
    </AuthCard>
  );
}
