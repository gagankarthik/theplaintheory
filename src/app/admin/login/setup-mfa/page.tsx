import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffMfaSetupForm } from "@/components/admin/staff-auth-forms";
import { maskEmail } from "@/lib/auth/cognito-errors";
import { getStaffChallenge } from "@/lib/auth/staff";
import { otpauthUri } from "@/lib/auth/totp";

export const metadata: Metadata = { title: "Set up your authenticator" };

export default async function StaffSetupMfaPage() {
  // The secret comes from Cognito (AssociateSoftwareToken) and lives only in the sealed challenge cookie.
  const challenge = await getStaffChallenge("mfa_setup");
  if (!challenge?.secret) redirect("/admin/login?expired=1");
  return (
    <>
      <p className="text-sm font-medium text-ink-3">Step 2 of 2 · {maskEmail(challenge.email)}</p>
      <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.03em]">Set up your authenticator</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">The staff console always asks for a code from an authenticator app. Finish within 3 minutes.</p>
      <StaffMfaSetupForm secret={challenge.secret} uri={otpauthUri(challenge.secret, challenge.email, "Plain Theory Staff")} />
    </>
  );
}
