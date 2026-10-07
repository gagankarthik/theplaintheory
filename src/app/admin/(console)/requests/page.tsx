import { FilterLinks, RequestsList } from "@/components/admin/requests-list";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { LEAD_STATUSES, LEAD_TOPICS, STATUS_LABEL, TOPIC_LABEL, matchesReference } from "@/lib/lead-options";
import { getStore } from "@/lib/store";
import type { LeadStatus, LeadTopic } from "@/lib/types";

export const generateMetadata = () => staffMetadata("Requests");

const LIMIT = 300;
const ALL = "all";

const pick = <T extends string>(v: string | string[] | undefined, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("leads:read");
  const sp = await searchParams;
  const status = pick<LeadStatus>(sp.status, LEAD_STATUSES);
  const topic = pick<LeadTopic>(sp.topic, LEAD_TOPICS);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";

  const store = await getStore();
  const all = await store.listLeads({ status, topic, limit: LIMIT });
  const needle = q.toLowerCase();
  const leads = needle
    ? all.filter((l) => matchesReference(l.id, q) || l.email.toLowerCase().includes(needle) || l.name.toLowerCase().includes(needle) || (l.company ?? "").toLowerCase().includes(needle))
    : all;

  const href = (next: { status?: string; topic?: string }) => {
    const p = new URLSearchParams();
    const s = next.status ?? status ?? ALL;
    const t = next.topic ?? topic ?? ALL;
    if (s !== ALL) p.set("status", s);
    if (t !== ALL) p.set("topic", t);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/admin/requests${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(status || topic || q);

  return (
    <>
      <PageHeader
        live
        title="Requests"
        description="Support tickets, sales enquiries, partner and enterprise requests from the public contact forms, newest first. Status changes are audited."
      />

      <div className="mb-5 space-y-3">
        <FilterLinks label="Status" current={status ?? ALL} options={[{ value: ALL, label: "All" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} href={(v) => href({ status: v })} />
        <FilterLinks label="Topic" current={topic ?? ALL} options={[{ value: ALL, label: "All" }, ...LEAD_TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] }))]} href={(v) => href({ topic: v })} />
        <form role="search" action="/admin/requests" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {topic ? <input type="hidden" name="topic" value={topic} /> : null}
          <div className="min-w-0 sm:w-80">
            <label htmlFor="req-q" className="label">
              Search requests
            </label>
            <input id="req-q" name="q" type="search" defaultValue={q} placeholder="Reference, name, email or company" className="field max-sm:h-11" autoComplete="off" spellCheck={false} />
          </div>
          <button type="submit" className="btn btn-ghost max-sm:h-11">
            Search
          </button>
        </form>
        <p aria-live="polite" className="text-sm text-ink-3">
          {leads.length} {leads.length === 1 ? "request" : "requests"}
          {filtered ? " match these filters" : ""}
          {all.length >= LIMIT ? ` (newest ${LIMIT} loaded)` : ""}
        </p>
      </div>

      {leads.length ? (
        <RequestsList leads={leads} />
      ) : (
        <EmptyState title={filtered ? "No requests match" : "No requests yet"}>
          {filtered ? "Try another status or topic, or clear the search." : "Requests from /contact, /contact-sales and the request forms appear here as soon as they're sent."}
        </EmptyState>
      )}
    </>
  );
}
