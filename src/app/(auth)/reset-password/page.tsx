import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/app/auth/auth-forms";
import { maskEmail } from "@/lib/auth/cognito-errors";
import { RESET_COOKIE, readPendingReset, resendAvailableAt } from "@/lib/auth/pending";
import { isCognito, passwordHint } from "@/lib/auth/provider";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Enter the code from your email and choose a new Plain Theory password.",
  alternates: { canonical: "/reset-password" },
};

export default async function ResetPasswordPage() {
  if (!isCognito()) redirect("/forgot-password");
  const pending = await readPendingReset((await cookies()).get(RESET_COOKIE)?.value);
  const masked = pending ? maskEmail(pending.email) : undefined;

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Set a new password</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">
        {masked ? (
          <>
            If <span className="font-medium text-ink">{masked}</span> has an account, we sent it a 6-digit code. It can take a minute to arrive;
            check spam if it doesn&apos;t. Setting a new password signs you out everywhere.
          </>
        ) : (
          "Enter your email, the 6-digit code we sent to it and a new password. Setting a new password signs you out everywhere."
        )}
      </p>
      <ResetPasswordForm maskedEmail={masked} resendAt={resendAvailableAt(pending?.sentAt)} passwordHint={passwordHint()} />
    </>
  );
}
