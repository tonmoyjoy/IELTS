import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "./RegisterForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { isGoogleConfigured } from "@/server/auth/google";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Free to start. Verify your email, then practise all four IELTS modules."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {isGoogleConfigured() && <GoogleButton label="Sign up with Google" />}
        <RegisterForm />
      </div>
    </AuthCard>
  );
}
