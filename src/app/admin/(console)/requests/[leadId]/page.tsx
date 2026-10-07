import { notFound } from "next/navigation";
import { fmtDateTime } from "@/components/admin/format";
import { LeadStatusActions } from "@/components/admin/lead-status-actions";
import { LeadStatusBadge, LeadTopicBadge, SeverityBadge, leadSummary } from "@/components/admin/requests-list";
import { PageHeader } from "@/components/app/shell/page-header";
import { buttonClass } from "@/components/app/ui/button";
import { canPlatform } from "@/lib/auth/platform";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { DETAIL_LABEL, REGION_CHOICES, TOPIC_LABEL, categoryLabel, detailValueLabel, labelOf, leadReference } from "@/lib/lead-options";
import { getStore } from "@/lib/store";

export const generateMetadata = () => staffMetadata("Request");

const CATEGORY_TITLE = { sales: "Category", support: "Category", partner: "Query type", enterprise: "Request type" } as const;

export default async function AdminRequestPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const ctx = await requireStaff("leads:read");
  if (!/^lead_[A-Za-z0-9_-]{4,40}$/.test(leadId)) notFound();
  const store = await getStore();
  const lead = await store.getLead(leadId);
  if (!lead) notFound();

  const topic = lead.topic ?? "sales";
  const status = lead.status ?? "new";
  const ref = leadReference(lead.id);
  const summary = leadSummary(lead);
  const replySubject = `Re: ${lead.subject ?? `Your ${TOPIC_LABEL[topic].toLowerCase()} request`} [${ref}]`;

  const facts: [string, React.ReactNode][] = [
    ["Reference", <span key="ref" className="font-mono">{ref}</span>],
    ["Name", lead.name],
    ["Email", <a key="email" href={`mailto:${lead.email}`} className="break-all text-brand underline-offset-4 hover:underline">{lead.email}</a>],
  ];
  if (lead.company) facts.push(["Company", lead.company]);
  if (lead.category) facts.push([CATEGORY_TITLE[topic], categoryLabel(topic, lead.category)]);
  if (lead.severity) facts.push(["Severity", <SeverityBadge key="sev" severity={lead.severity} />]);
  if (lead.sites) facts.push(["Websites", lead.sites]);
  if (lead.pageviews) facts.push(["Monthly pageviews", lead.pageviews]);
  if (lead.regions?.length) facts.push(["Regions", lead.regions.map((r) => labelOf(REGION_CHOICES, r)).join(", ")]);
  for (const [k, v] of Object.entries(lead.details ?? {})) facts.push([DETAIL_LABEL[k] ?? k, detailValueLabel(k, v)]);
  facts.push(["Received", fmtDateTime(lead.createdAt)]);
  if (lead.updatedAt) facts.push(["Status changed", fmtDateTime(lead.updatedAt)]);

  return (
    <>
      <PageHeader
        title={summary}
        crumbs={[{ label: "Staff console" }, { label: "Overview", href: "/admin" }, { label: "Requests", href: "/admin/requests" }, { label: ref }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <LeadStatusBadge status={status} />
            <LeadTopicBadge topic={topic} />
            <span>
              from {lead.name}
              {lead.company ? ` at ${lead.company}` : ""}
            </span>
          </span>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
            {canPlatform(ctx.role, "leads:manage") ? <LeadStatusActions leadId={lead.id} status={status} /> : null}
            <a href={`mailto:${lead.email}?subject=${encodeURIComponent(replySubject)}`} className={buttonClass("ghost", "md", "w-full max-sm:h-11 sm:w-auto")}>
              Reply by email
            </a>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="message-h" className="lg:col-span-7">
          <h2 id="message-h" className="mb-3 text-lg font-bold">
            Message
          </h2>
          <div className="rounded-lg border border-line bg-surface px-5 py-4">
            {lead.subject ? <p className="mb-3 font-bold">{lead.subject}</p> : null}
            {lead.message ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{lead.message}</p>
            ) : (
              <p className="text-sm text-ink-3">No message was included.</p>
            )}
          </div>
        </section>
        <section aria-labelledby="facts-h" className="lg:col-span-5">
          <h2 id="facts-h" className="mb-3 text-lg font-bold">
            Details
          </h2>
          <dl className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 px-5 py-3">
                <dt className="text-ink-3">{k}</dt>
                <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-3">The sender&apos;s IP address is stored only as a salted hash, for abuse limits. Requests are deleted after 24 months.</p>
        </section>
      </div>
    </>
  );
}
