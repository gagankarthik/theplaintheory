import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffNewPasswordForm } from "@/components/admin/staff-auth-forms";
import { maskEmail } from "@/lib/auth/cognito-errors";
import { getStaffChallenge } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Choose a password" };

export default async function StaffNewPasswordPage() {
  // Only reachable straight after signing in with the e-mailed temporary password (3-minute window).
  const challenge = await getStaffChallenge("new_password");
  if (!challenge) redirect("/admin/login?expired=1");
  return (
    <>
      <p className="text-sm font-medium text-ink-3">Step 1 of 2 · {maskEmail(challenge.email)}</p>
      <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.03em]">Choose your password</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">Replace the temporary password from your invite. Next you&apos;ll set up an authenticator app.</p>
      <StaffNewPasswordForm email={challenge.email} />
    </>
  );
}
