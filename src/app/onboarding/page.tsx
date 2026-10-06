import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/icons";
import { getSignedInUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const session = await getSignedInUser();
  if (!session) redirect("/login");
  const memberships = await (await getStore()).listMemberships(session.userId);
  if (memberships.length) redirect("/app");

  return (
    <div className="min-h-dvh bg-paper">
      <header className="container-page flex h-16 items-center">
        <Link href="/" aria-label="Plain Theory home">
          <Logo />
        </Link>
      </header>
      <main className="container-page grid gap-12 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:py-16">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold">Set up your workspace</h1>
          <p className="mt-4 text-base text-ink-2">
            An organization holds your sites, team and billing. Agencies usually create one per client so each client&apos;s
            consent records stay separate.
          </p>
          <ol className="mt-10 space-y-6">
            {[
              ["Name the organization and site", "You can add more sites later."],
              ["Paste one script tag", "We show you the snippet next."],
              ["Publish your banner", "Defaults are already compliant for GDPR, CCPA and DPDPA."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${i === 0 ? "bg-ink text-paper" : "border border-line-strong text-ink-3"}`}>
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold">{t}</p>
                  <p className="text-sm text-ink-3">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel p-6 sm:p-8">
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
