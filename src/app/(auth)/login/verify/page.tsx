import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyCodeForm } from "@/components/app/auth/auth-forms";
import { MFA_COOKIE } from "@/lib/auth/session";
import { verifyMfaChallenge } from "@/lib/auth/token";

export const metadata: Metadata = {
  title: "Two-factor sign-in",
  description: "Enter the code from your authenticator app to finish signing in to Plain Theory.",
  alternates: { canonical: "/login/verify" },
};

export default async function VerifyPage() {
  // Only reachable straight after a correct password; the challenge cookie lasts 5 minutes.
  if (!(await verifyMfaChallenge((await cookies()).get(MFA_COOKIE)?.value))) redirect("/login");
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Check your authenticator</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Your account has two-factor sign-in turned on. Enter the current code to finish.</p>
      <VerifyCodeForm />
    </>
  );
}
