import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/app/auth/auth-forms";
import { isCognito } from "@/lib/auth/provider";
import { getSignedInUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a code by email to set a new Plain Theory password.",
  alternates: { canonical: "/forgot-password" },
};

export default async function ForgotPasswordPage() {
  // Signed in already: the account page changes the password with the current one.
  if (await getSignedInUser()) redirect("/app/account");

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Reset your password</h1>
      {isCognito() ? (
        <>
          <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Enter the email you sign in with. If it has an account, we&apos;ll send a 6-digit code to set a new password.</p>
          <ForgotPasswordForm />
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[15px] text-ink-3">
            Password reset by email isn&apos;t available in this environment. Ask a workspace owner or{" "}
            <a href="mailto:support@theplaintheory.in" className="font-medium text-brand underline-offset-4 hover:underline">
              support@theplaintheory.in
            </a>{" "}
            for help.
          </p>
          <p className="mt-8 text-center text-sm text-ink-3">
            <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-brand underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </>
  );
}
