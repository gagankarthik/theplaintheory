import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/app/auth/auth-forms";
import { SetupSteps } from "@/components/app/auth/setup-steps";
import { IconCheck } from "@/components/icons";
import { passwordHint } from "@/lib/auth/provider";
import { getSignedInUser } from "@/lib/auth/session";
import { issueFormToken } from "@/lib/form-guard";
import { PLANS } from "@/lib/plans";
import { getStore } from "@/lib/store";
import { ButtonLink } from "@/components/app/ui/button";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a free Plain Theory account: real tracker blocking and a tamper-evident consent log for your first site, no card needed.",
  alternates: { canonical: "/auth/signup" },
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getSignedInUser()) redirect("/app");
  const { plan: planParam, email: emailParam, invite: inviteParam } = await searchParams;
  // Team invite links pre-fill the invited address (they still have to prove it with the emailed code).
  const email = typeof emailParam === "string" && emailParam.length <= 254 && emailParam.includes("@") ? emailParam : undefined;
  const plan = PLANS.find((p) => p.id === planParam && p.id !== "free" && p.id !== "enterprise");

  // A team invite: shown only when the link's random invite id and its email match a pending invite,
  // so the page never tells a stranger who invited an address. The account joins the team on sign-up.
  const store = email && typeof inviteParam === "string" ? await getStore() : null;
  const invite = store ? (await store.invitesForEmail(email!)).find((i) => i.id === inviteParam) : undefined;
  const team = invite ? await store!.getOrg(invite.orgId) : null;
  // the invited address already has an account: it was added straight away, so signing in is all that's left
  const hasAccount = invite && store ? Boolean(await store.getUserByEmail(invite.email)) : false;

  if (invite && team) {
    const article = invite.role === "admin" || invite.role === "auditor" || invite.role === "editor" ? "an" : "a";
    return (
      <>
        <p className="eyebrow">Team invite</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em]">Join {team.name}</h1>
        <p className="mt-1.5 text-[15px] text-ink-3">
          {invite.invitedBy ? `${invite.invitedBy} invited you` : "You were invited"} as {article} {invite.role}. {hasAccount ? "Sign in to open it." : "Choose a password to join; there's nothing else to set up."}
        </p>
        <div className="mt-8 short:mt-5 shorter:mt-4">
          {hasAccount ? (
            <ButtonLink href="/auth/login" className="w-full">
              Sign in
            </ButtonLink>
          ) : (
            <SignupForm formToken={issueFormToken("signup")} passwordHint={passwordHint()} email={invite.email} invited />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <SetupSteps />

      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-ink-3">
        {plan ? "Next you'll set up your organization and first site, then confirm your plan." : "Free for one site. Your banner can be live in about five minutes."}
      </p>

      {plan ? (
        <div className="mt-5 flex items-center gap-3 rounded-[14px] bg-brand-wash/60 px-4 py-3 ring-1 ring-inset ring-brand/20">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-solid text-on-brand-solid">
            <IconCheck size={16} />
          </span>
          <p className="min-w-0 flex-1 text-sm text-ink-2">
            <span className="font-semibold text-ink">{plan.name} plan selected.</span> You can change it before paying.
          </p>
          <Link href="/pricing" className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand underline-offset-4 hover:underline">
            Change
          </Link>
        </div>
      ) : null}

      <div className="mt-8 short:mt-5 shorter:mt-4">
        <SignupForm formToken={issueFormToken("signup")} plan={plan?.id} passwordHint={passwordHint()} email={email} />
      </div>
    </>
  );
}
