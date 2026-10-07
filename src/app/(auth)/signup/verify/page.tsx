import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignupVerifyForm } from "@/components/app/auth/auth-forms";
import { SetupSteps } from "@/components/app/auth/setup-steps";
import { maskEmail } from "@/lib/auth/cognito-errors";
import { SIGNUP_COOKIE, readPendingSignup, resendAvailableAt } from "@/lib/auth/pending";
import { isCognito } from "@/lib/auth/provider";
import { getSignedInUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Enter the 6-digit code we emailed you to finish creating your Plain Theory account.",
  alternates: { canonical: "/signup/verify" },
};

export default async function SignupVerifyPage() {
  // The local auth driver signs people in at sign-up; there's no code to confirm.
  if (!isCognito()) redirect("/signup");
  if (await getSignedInUser()) redirect("/app");
  const pending = await readPendingSignup((await cookies()).get(SIGNUP_COOKIE)?.value);
  const masked = pending ? maskEmail(pending.email) : undefined;

  return (
    <>
      {pending?.next ? null : <SetupSteps current={1} />}
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Check your email</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">
        {masked ? (
          <>
            We sent a 6-digit code to <span className="font-medium text-ink">{masked}</span>. It can take a minute to arrive; check spam if
            it doesn&apos;t.
          </>
        ) : (
          "Enter the email you signed up with and the 6-digit code we sent to it."
        )}
      </p>
      <SignupVerifyForm maskedEmail={masked} resendAt={resendAvailableAt(pending?.sentAt)} />
    </>
  );
}
