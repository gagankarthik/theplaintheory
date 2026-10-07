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
  if (!session) redirect("/login");
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
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Link href="/" aria-label="Plain Theory home" className="flex min-h-11 items-center">
            <Logo />
          </Link>
          <p className="truncate pl-4 text-sm text-ink-3">{session.email}</p>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <section aria-labelledby="suspended-h" className="panel p-6 sm:p-8">
          <span className="grid size-11 place-items-center rounded-full bg-rose-wash text-rose" aria-hidden>
            <IconAlert size={22} />
          </span>
          <h1 id="suspended-h" className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
            {active.name} is suspended
          </h1>
          <p className="mt-2 text-base text-ink-2">
            This organization is suspended, so its dashboard is unavailable. Your data is kept and nothing has been deleted. Contact support to resolve it.
          </p>
          <dl className="mt-5 grid gap-3 rounded-md bg-paper px-4 py-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
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
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </section>

        {others.length ? (
          <section aria-labelledby="others-h" className="mt-8">
            <h2 id="others-h" className="mb-3 text-base font-bold">
              Your other organizations
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {others.map((o) => (
                <li key={o.id}>
                  <form action={switchFromSuspended} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <input type="hidden" name="orgId" value={o.id} />
                    <span className="min-w-0 truncate text-sm font-bold">{o.name}</span>
                    <Button type="submit" variant="ghost" size="sm">
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
