import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditTimeline } from "@/components/app/audit/audit-timeline";
import { VerifyAuditChain, type AuditRow } from "@/components/app/audit/audit-view";
import { PageHeader } from "@/components/app/shell/page-header";
import { buttonClass } from "@/components/app/ui/button";
import { IconDownload } from "@/components/icons";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { AUDIT_ACTION_LABELS, verifyAuditChain } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import type { AuditEvent } from "@/lib/types";
import { Select } from "@/components/app/ui/select";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;

const CATEGORIES: { value: string; label: string }[] = [
  { value: "auth", label: "Sign-in and account security" },
  { value: "member", label: "Team and access" },
  { value: "org", label: "Organization settings" },
  { value: "property", label: "Sites and publishing" },
  { value: "banner", label: "Banner drafts" },
  { value: "regions", label: "Regions" },
  { value: "notice", label: "Notice settings" },
  { value: "tracker", label: "Trackers" },
  { value: "language", label: "Languages" },
  { value: "webhook", label: "Webhooks" },
  { value: "billing", label: "Billing" },
  { value: "logs", label: "Consent log exports and checks" },
  { value: "evidence", label: "Evidence Pack exports" },
  { value: "access_review", label: "Access reviews" },
  { value: "audit", label: "Audit log exports and checks" },
  { value: "retention", label: "Retention" },
];

const details = (e: AuditEvent) =>
  e.metadata
    ? Object.entries(e.metadata)
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : "";

export default async function AuditPage(props: PageProps<"/app/audit">) {
  const { org, role } = await requireUser();
  if (!can(role, "audit:read")) notFound();
  const sp = await props.searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const action = CATEGORIES.some((c) => c.value === str(sp.action)) ? str(sp.action) : undefined;
  const actor = str(sp.actor);
  const before = Number(str(sp.before)) || undefined;

  const store = await getStore();
  // The page of events, plus the whole trail: the strip counts every event (not a sample) and verifies the chain.
  const [events, members, trail] = await Promise.all([
    store.listAudit(org.id, {
      before,
      action,
      actorUserId: actor,
      limit: PAGE + 1,
    }),
    store.listMembers(org.id),
    store.listAudit(org.id),
  ]);
  const page = events.slice(0, PAGE);
  const hasMore = events.length > PAGE;

  const rows: AuditRow[] = page.map((e) => ({
    seq: e.seq,
    createdAt: e.createdAt,
    actor: e.actorEmail,
    system: e.actorUserId === null,
    action: e.action,
    label: AUDIT_ACTION_LABELS[e.action] ?? e.action,
    target: e.target.label ?? `${e.target.type} ${e.target.id}`,
    details: details(e),
    hash: e.hash,
  }));

  const filterQs = new URLSearchParams({
    ...(action ? { action } : {}),
    ...(actor ? { actor } : {}),
  });
  const qs = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({
      ...Object.fromEntries(filterQs),
      ...extra,
    }).toString();
    return q ? `?${q}` : "?";
  };

  const now = new Date();
  const since = now.getTime() - 30 * 86_400_000;
  const last30 = trail.filter((e) => Date.parse(e.createdAt) >= since);
  const signIns = last30.filter((e) => e.action === "auth.login").length;
  const failed = last30.filter((e) => e.action === "auth.login_failed").length;
  const chain = verifyAuditChain(trail);
  const n = (v: number) => v.toLocaleString("en-GB");

  return (
    <>
      <PageHeader
        live
        title="Audit log"
        description={`Who changed what in ${org.name}: sign-ins, access, settings, publishing and exports.`}
        actions={
          <>
            <VerifyAuditChain />
            <a className={buttonClass("primary")} href={`/api/app/audit/export${filterQs.size ? `?${filterQs}` : ""}`} download>
              <IconDownload size={18} />
              Export CSV
            </a>
          </>
        }
      />

      <StatStrip
        label="Audit activity at a glance"
        stats={[
          {
            label: "Events, last 30 days",
            value: n(last30.length),
            note: `${n(trail.length)} in the whole log`,
          },
          {
            label: "Sign-ins, last 30 days",
            value: n(signIns),
            note: "Successful sign-ins",
          },
          {
            label: "Failed sign-ins, last 30 days",
            value: n(failed),
            note: failed ? "Wrong password or code" : "None",
            tone: failed > 0 ? "bad" : undefined,
            href: failed > 0 ? "/app/audit?action=auth" : undefined,
          },
          {
            label: "Chain integrity",
            value: chain.ok ? "Intact" : "Broken",
            note: chain.ok ? `${n(chain.checked)} events link correctly` : `At event #${chain.brokenAt}: treat as an incident`,
            tone: chain.ok ? undefined : "bad",
          },
        ]}
      />

      {/* Filters */}
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end" aria-label="Filter audit events">
        <div>
          <label htmlFor="f-action" className="label">
            Activity
          </label>
          <div className="w-full sm:w-60">
            <Select
              id="f-action"
              name="action"
              defaultValue={action ?? ""}
              options={[{ value: "", label: "All activity" }, ...CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
            />
          </div>
        </div>
        <div>
          <label htmlFor="f-actor" className="label">
            Person
          </label>
          <div className="w-full sm:w-60">
            <Select
              id="f-actor"
              name="actor"
              defaultValue={actor ?? ""}
              menuWidth={280}
              options={[
                { value: "", label: "Everyone" },
                ...members
                  .filter((m) => m.user)
                  .map((m) => ({
                    value: m.userId,
                    label: m.user!.name || m.user!.email,
                    description: m.user!.email,
                  })),
              ]}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("ghost")}>
            Apply
          </button>
          {action || actor ? (
            <Link href="/app/audit" className={buttonClass("quiet")}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-6">
        <AuditTimeline rows={rows} now={now} />
      </div>

      <nav aria-label="Audit log pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-3">
        <span>{page.length ? `Showing #${page[page.length - 1].seq} to #${page[0].seq}` : "No events"}</span>
        <span className="flex gap-2">
          {before ? (
            <Link href={qs()} className={buttonClass("ghost", "sm")}>
              Newest
            </Link>
          ) : null}
          {hasMore ? (
            <Link href={qs({ before: String(page[page.length - 1].seq) })} className={buttonClass("ghost", "sm")}>
              Older events
            </Link>
          ) : null}
        </span>
      </nav>
      <p className="mt-4 text-xs text-ink-3">
        Times are in UTC. Each event includes the hash of the one before it, so an edited or removed event breaks the chain. Events are kept for at least one year and are never
        removed by the retention job. IP addresses are stored only as salted hashes of the truncated address.
      </p>
    </>
  );
}
