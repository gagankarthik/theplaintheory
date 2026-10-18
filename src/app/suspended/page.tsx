import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/app/actions";
import { Button, buttonClass } from "@/components/app/ui/button";
import { IconAlert, Logo } from "@/components/icons";
import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { switchFromSuspended } from "./actions";

export const metadata: Metadata = { title: "Organization suspended", robots: { index: false, follow: false } };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Shown instead of the dashboard when the member's active organization is suspended by Plain Theory staff. */
export default async function SuspendedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const { org: requested } = await searchParams;
  const store = await getStore();
  const memberships = await store.listMemberships(session.userId);
  const orgs = (await Promise.all(memberships.map((m) => store.getOrg(m.orgId)))).filter((o) => o !== null);
  // ?org= names a suspended org the user opened a site from; only honoured for their own memberships.
  const active =
    (typeof requested === "string" ? orgs.find((o) => o.id === requested) : undefined) ?? orgs.find((o) => o.id === session.orgId) ?? orgs.find((o) => o.id === memberships[0]?.orgId);
  if (!active) redirect("/onboarding");
  if (!active.suspendedAt) redirect("/app");
  const others = orgs.filter((o) => o.id !== active.id && !o.suspendedAt);

  return (
    <div className="pt-app min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Link href="/" aria-label="Plain Theory home" className="flex min-h-11 items-center">
            <Logo />
          </Link>
          <p className="truncate pl-4 text-sm text-ink-3">{session.email}</p>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <section aria-labelledby="suspended-h" className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <span className="grid size-11 place-items-center rounded-full bg-destructive-wash text-destructive" aria-hidden>
            <IconAlert size={22} />
          </span>
          <h1 id="suspended-h" className="mt-4 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
            {active.name} is suspended
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            This organization is suspended, so its dashboard is unavailable. Your data is kept and nothing has been deleted. Contact support to resolve it.
          </p>
          <dl className="mt-5 grid gap-1 rounded-md bg-raised px-4 py-3 text-sm ring-1 ring-inset ring-line sm:grid-cols-[auto_1fr] sm:gap-x-6 sm:gap-y-2">
            <dt className="text-ink-3">Suspended on</dt>
            <dd>{date(active.suspendedAt)}</dd>
            {active.suspendedReason ? (
              <>
                <dt className="text-ink-3">Reason</dt>
                <dd>{active.suspendedReason}</dd>
              </>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <a className={buttonClass("primary")} href={`mailto:support@theplaintheory.in?subject=${encodeURIComponent(`Suspension: ${active.name}`)}`}>
              Contact support
            </a>
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </section>

        {others.length ? (
          <section aria-labelledby="others-h" className="mt-8">
            <h2 id="others-h" className="mb-3 text-base font-semibold">
              Your other organizations
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {others.map((o) => (
                <li key={o.id}>
                  <form action={switchFromSuspended} className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <input type="hidden" name="orgId" value={o.id} />
                    <span className="min-w-0 truncate text-sm font-medium">{o.name}</span>
                    <Button type="submit" variant="secondary" size="sm">
                      Switch<span className="sr-only"> to {o.name}</span>
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
