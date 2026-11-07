import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Free to start. Verify your email, then practise all four IELTS modules."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
