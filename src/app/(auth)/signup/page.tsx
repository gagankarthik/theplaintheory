import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/app/auth/auth-forms";
import { IconCheck } from "@/components/icons";
import { getSignedInUser } from "@/lib/auth/session";
import { issueFormToken } from "@/lib/form-guard";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a free Plain Theory account: real tracker blocking and a tamper-evident consent log for your first site, no card needed.",
  alternates: { canonical: "/signup" },
};

const SETUP = ["Account", "Workspace", "Site", "Plan"];

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getSignedInUser()) redirect("/app");
  const { plan: planParam } = await searchParams;
  const plan = PLANS.find((p) => p.id === planParam && p.id !== "free" && p.id !== "enterprise");

  return (
    <>
      {/* Where this sits in setup: account now, the rest right after */}
      <ol aria-label="Setup steps" className="mb-8 flex items-center gap-1.5 short:mb-5">
        {SETUP.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={i === 0 ? "step" : undefined}>
            <span aria-hidden className={`h-1 rounded-full ${i === 0 ? "bg-brand" : "bg-line"}`} />
            <span className={`text-[11px] font-medium ${i === 0 ? "text-ink" : "text-ink-3"}`}>
              <span className="sr-only">Step {i + 1} of {SETUP.length}: </span>
              {s}
            </span>
          </li>
        ))}
      </ol>

      <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-ink-3">
        {plan ? "Next you'll set up your workspace and first site, then confirm your plan." : "Free for one site. Your banner can be live in about five minutes."}
      </p>

      {plan ? (
        <div className="mt-5 flex items-center gap-3 rounded-[14px] bg-brand-wash/60 px-4 py-3 ring-1 ring-inset ring-brand/20">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white">
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

      <div className="mt-8 short:mt-5">
        <SignupForm formToken={issueFormToken("signup")} plan={plan?.id} />
      </div>
    </>
  );
}
