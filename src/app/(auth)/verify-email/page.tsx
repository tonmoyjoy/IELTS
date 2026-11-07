import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { VerifyEmail } from "./VerifyEmail";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <AuthCard title="Verify your email">
      <VerifyEmail token={token} />
    </AuthCard>
  );
}
