import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/app/auth/auth-forms";
import { getSignedInUser } from "@/lib/auth/session";
import { issueFormToken } from "@/lib/form-guard";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a free Plain Theory account: real tracker blocking and a tamper-evident consent log for your first site, no card needed.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage() {
  if (await getSignedInUser()) redirect("/app");
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Create your account</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Free for one site. Your banner can be live in about five minutes.</p>
      <SignupForm formToken={issueFormToken("signup")} />
    </>
  );
}
