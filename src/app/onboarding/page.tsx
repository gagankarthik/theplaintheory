import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/icons";
import { getSignedInUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import type { PlanId } from "@/lib/types";
import { getLivePlans } from "@/lib/stripe-catalog";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Set up your organization", robots: { index: false, follow: false } };

const SELF_SERVE: PlanId[] = ["free", "starter", "growth", "business"];
const asPlan = (v: unknown) => (typeof v === "string" && (SELF_SERVE as string[]).includes(v) ? (v as PlanId) : undefined);

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSignedInUser();
  if (!session) redirect("/login");
  const store = await getStore();
  const memberships = await store.listMemberships(session.userId);
  if (memberships.length) redirect("/app");
  const user = await store.getUser(session.userId);
  const { plan } = await searchParams;

  return (
    <div className="pt-app min-h-dvh bg-canvas text-ink">
      <header className="container-page flex h-16 items-center justify-between border-b border-line">
        <Link href="/" aria-label="Plain Theory home" className="flex min-h-11 items-center">
          <Logo />
        </Link>
        <p className="truncate pl-4 text-sm text-ink-3">{session.email}</p>
      </header>
      <main className="container-page max-w-4xl py-8 sm:py-12">
        <h1 className="sr-only">Set up your organization</h1>
        <OnboardingForm userName={user?.name} initialPlan={asPlan(plan)} plans={(await getLivePlans()).filter((p) => p.id !== "enterprise")} />
      </main>
    </div>
  );
}
