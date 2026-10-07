import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/icons";
import { getSignedInUser } from "@/lib/auth/session";
import { getLivePlans } from "@/lib/stripe-catalog";
import { OnboardingForm } from "../form";

export const metadata: Metadata = { title: "New organization", robots: { index: false, follow: false } };

/** Additional organization for an existing user (e.g. an agency adding a client). */
export default async function NewOrgPage() {
  if (!(await getSignedInUser())) redirect("/login");
  return (
    <div className="min-h-dvh bg-paper">
      <header className="container-page flex h-16 items-center justify-between">
        <Link href="/app" className="flex min-h-11 items-center" aria-label="Back to dashboard">
          <Logo />
        </Link>
        <Link href="/app" className="inline-flex min-h-11 items-center text-sm font-bold text-ink-2 hover:text-ink">
          Cancel
        </Link>
      </header>
      <main className="container-page max-w-4xl py-8 sm:py-12">
        <h1 className="text-2xl font-bold">New organization</h1>
        <p className="mb-8 mt-2 text-base text-ink-2">Each organization has its own sites, team, billing and consent records.</p>
        <OnboardingForm plans={(await getLivePlans()).filter((p) => p.id !== "enterprise")} />
      </main>
    </div>
  );
}
