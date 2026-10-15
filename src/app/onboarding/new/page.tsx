import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/app/ui/button";
import { Logo } from "@/components/icons";
import { getSignedInUser } from "@/lib/auth/session";
import { getLivePlans } from "@/lib/stripe-catalog";
import { OnboardingForm } from "../form";

export const metadata: Metadata = { title: "New organization", robots: { index: false, follow: false } };

/** Additional organization for an existing user (e.g. an agency adding a client). */
export default async function NewOrgPage() {
  if (!(await getSignedInUser())) redirect("/login");
  return (
    <div className="pt-app min-h-dvh bg-canvas text-ink">
      <header className="container-page flex h-16 items-center justify-between border-b border-line">
        <Link href="/app" className="flex min-h-11 items-center" aria-label="Back to dashboard">
          <Logo />
        </Link>
        <ButtonLink href="/app" variant="quiet" size="sm">
          Cancel
        </ButtonLink>
      </header>
      <main className="container-page max-w-4xl py-8 sm:py-12">
        <h1 className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">New organization</h1>
        <p className="mb-6 mt-2 text-sm text-ink-3 sm:mb-8">Each organization has its own sites, team, billing and consent records.</p>
        <OnboardingForm plans={(await getLivePlans()).filter((p) => p.id !== "enterprise")} />
      </main>
    </div>
  );
}
