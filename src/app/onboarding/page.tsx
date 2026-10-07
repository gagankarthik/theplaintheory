import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/icons";
import { getSignedInUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import type { PlanId } from "@/lib/types";
import { getLivePlans } from "@/lib/stripe-catalog";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false, follow: false } };

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
    <div className="relative min-h-dvh overflow-hidden bg-paper">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,var(--color-brand-wash),transparent)]" />
      <header className="container-page relative flex h-16 items-center justify-between">
        <Link href="/" aria-label="Plain Theory home" className="flex min-h-11 items-center">
          <Logo />
        </Link>
        <p className="truncate pl-4 text-sm text-ink-3">{session.email}</p>
      </header>
      <main className="container-page relative max-w-4xl py-8 sm:py-14">
        <h1 className="sr-only">Set up your workspace</h1>
        <OnboardingForm userName={user?.name} initialPlan={asPlan(plan)} plans={(await getLivePlans()).filter((p) => p.id !== "enterprise")} />
      </main>
    </div>
  );
}
