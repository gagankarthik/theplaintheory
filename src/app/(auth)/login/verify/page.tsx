import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifySecondStep } from "@/components/app/auth/auth-forms";
import { hasTotp, passkeysOf } from "@/lib/auth/second-factor";
import { MFA_COOKIE } from "@/lib/auth/session";
import { verifyMfaChallenge } from "@/lib/auth/token";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Two-factor sign-in",
  description: "Use your passkey or the code from your authenticator app to finish signing in to Plain Theory.",
  alternates: { canonical: "/login/verify" },
};

export default async function VerifyPage() {
  // Only reachable straight after a correct password; the challenge cookie lasts 5 minutes.
  const challenge = await verifyMfaChallenge((await cookies()).get(MFA_COOKIE)?.value);
  if (!challenge) redirect("/login");
  const user = await (await getStore()).getUser(challenge.userId);
  if (!user?.mfa) redirect("/login");
  const passkeys = passkeysOf(user.mfa).length > 0;
  return (
    <>
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">{passkeys ? "Confirm it's you" : "Check your authenticator"}</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-ink-3 short:mb-5">
        {passkeys
          ? "Your account has two-factor sign-in turned on. Use your passkey to finish."
          : "Your account has two-factor sign-in turned on. Enter the current code to finish."}
      </p>
      <VerifySecondStep passkeys={passkeys} totp={hasTotp(user.mfa)} />
    </>
  );
}
