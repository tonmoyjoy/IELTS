import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Alert } from "@/components/ui";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <AuthCard
      title="Choose a new password"
      description="Resetting your password signs you out on every device."
      footer={<Link href="/login" className="hover:underline">Back to sign in</Link>}
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error">
          This reset link is incomplete. <Link href="/forgot-password" className="font-medium underline">Request a new one</Link>.
        </Alert>
      )}
    </AuthCard>
  );
}
