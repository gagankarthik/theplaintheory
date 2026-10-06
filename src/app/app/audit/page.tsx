import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditTable, VerifyAuditChain, type AuditRow } from "@/components/app/audit/audit-view";
import { PageHeader } from "@/components/app/shell/page-header";
import { buttonClass } from "@/components/app/ui/button";
import { IconDownload } from "@/components/icons";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import type { AuditEvent } from "@/lib/types";

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
  const [events, members] = await Promise.all([store.listAudit(org.id, { before, action, actorUserId: actor, limit: PAGE + 1 }), store.listMembers(org.id)]);
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

  const filterQs = new URLSearchParams({ ...(action ? { action } : {}), ...(actor ? { actor } : {}) });
  const qs = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ ...Object.fromEntries(filterQs), ...extra }).toString();
    return q ? `?${q}` : "?";
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Who changed what in ${org.name}: sign-ins, access, settings, publishing and exports. Each event includes the hash of the one before it, so an edited or deleted event breaks the chain.`}
        actions={
          <a className={buttonClass("primary")} href={`/api/app/audit/export${filterQs.size ? `?${filterQs}` : ""}`} download>
            <IconDownload size={18} />
            Export CSV
          </a>
        }
      />

      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end" aria-label="Filter audit events">
          <div>
            <label htmlFor="f-action" className="label">
              Activity
            </label>
            <select id="f-action" name="action" defaultValue={action ?? ""} className="field h-10 w-full py-0 sm:w-64">
              <option value="">All activity</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-actor" className="label">
              Person
            </label>
            <select id="f-actor" name="actor" defaultValue={actor ?? ""} className="field h-10 w-full py-0 sm:w-64">
              <option value="">Everyone</option>
              {members
                .filter((m) => m.user)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user!.email}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("ghost")}>
              Filter
            </button>
            {action || actor ? (
              <Link href="/app/audit" className={buttonClass("quiet")}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>
        <VerifyAuditChain />
      </div>

      <AuditTable
        rows={rows}
        footer={
          <nav aria-label="Audit log pages" className="flex items-center justify-between gap-3">
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
        }
      />
      <p className="mt-4 text-xs text-ink-3">
        Events are kept for at least one year and are never removed by the retention job. IP addresses are stored only as salted hashes of the truncated address.
      </p>
    </>
  );
}
