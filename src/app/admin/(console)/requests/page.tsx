import { FilterChips, type FilterChip } from "@/components/admin/filter-bar";
import { RequestsTable } from "@/components/admin/requests-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { SelectField, TextField } from "@/components/app/ui/field";
import { FilterBar } from "@/components/app/ui/filter-bar";
import { IconMail } from "@/components/icons";
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

  /** The list URL with one filter changed (undefined drops it). */
  const href = (next: { status?: string; topic?: string; q?: string }) => {
    const p = new URLSearchParams();
    const s = "status" in next ? next.status : status;
    const t = "topic" in next ? next.topic : topic;
    const query = "q" in next ? next.q : q;
    if (s && s !== ALL) p.set("status", s);
    if (t && t !== ALL) p.set("topic", t);
    if (query) p.set("q", query);
    const qs = p.toString();
    return `/admin/requests${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(status || topic || q);
  const chips: FilterChip[] = [
    ...(q ? [{ key: "q", label: `Search: “${q}”`, href: href({ q: undefined }) }] : []),
    ...(status ? [{ key: "status", label: `Status: ${STATUS_LABEL[status]}`, href: href({ status: undefined }) }] : []),
    ...(topic ? [{ key: "topic", label: `Topic: ${TOPIC_LABEL[topic]}`, href: href({ topic: undefined }) }] : []),
  ];
  const noun = (n: number) => (n === 1 ? "request" : "requests");
  const summary = `${filtered ? `${leads.length.toLocaleString("en-GB")} ${noun(leads.length)} match` : `${leads.length.toLocaleString("en-GB")} ${noun(leads.length)}`}${all.length >= LIMIT ? `, newest ${LIMIT} loaded` : ""}`;

  return (
    <>
      <PageHeader
        live
        title="Requests"
        description="Support tickets, sales enquiries, partner and enterprise requests from the public contact forms, newest first. Status changes are audited."
      />

      {/* "Clear all" lives with the chips below, so the bar itself never shows a second clear link */}
      <FilterBar label="Filter requests" active={false} className="mb-3">
        <TextField key={`q-${q}`} id="req-q" name="q" type="search" label="Search" defaultValue={q} placeholder="Reference, name, email or company" autoComplete="off" spellCheck={false} />
        <SelectField key={`s-${status ?? ALL}`} id="req-status" name="status" label="Status" defaultValue={status ?? ALL} options={[{ value: ALL, label: "Any status" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
        <SelectField key={`t-${topic ?? ALL}`} id="req-topic" name="topic" label="Topic" defaultValue={topic ?? ALL} options={[{ value: ALL, label: "All topics" }, ...LEAD_TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] }))]} />
      </FilterBar>
      <FilterChips chips={chips} summary={summary} clearHref="/admin/requests" />

      {leads.length ? (
        <RequestsTable leads={leads} />
      ) : (
        <EmptyState icon={<IconMail size={22} />} title={filtered ? "No requests match" : "No requests yet"}>
          {filtered ? "Try another status or topic, or clear the search." : "Requests from the contact form appear here as soon as they're sent."}
        </EmptyState>
      )}
    </>
  );
}
