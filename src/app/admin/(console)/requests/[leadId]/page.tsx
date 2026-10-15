import { notFound } from "next/navigation";
import { fmtDateTime } from "@/components/admin/format";
import { LeadStatusActions } from "@/components/admin/lead-status-actions";
import { LeadStatusBadge, LeadTopicBadge, SeverityBadge, leadSummary } from "@/components/admin/requests-list";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonAnchor } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/app/ui/description-list";
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
    ["Email", <a key="email" href={`mailto:${lead.email}`} className="break-all text-ink underline underline-offset-4 hover:text-ink-2">{lead.email}</a>],
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
            <ButtonAnchor variant="secondary" href={`mailto:${lead.email}?subject=${encodeURIComponent(replySubject)}`} className="w-full sm:w-auto">
              Reply by email
            </ButtonAnchor>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card aria-labelledby="message-h" className="lg:col-span-7">
          <CardHeader titleId="message-h" title={lead.subject ?? "Message"} description={`Received ${fmtDateTime(lead.createdAt)}`} />
          <CardBody>
            {lead.message ? (
              <p className="max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{lead.message}</p>
            ) : (
              <p className="text-sm text-ink-3">No message was included.</p>
            )}
          </CardBody>
        </Card>
        <Card aria-labelledby="facts-h" className="self-start lg:col-span-5">
          <CardHeader titleId="facts-h" title="Details" />
          <CardBody>
            <DescriptionList layout="stacked" items={facts.map(([label, value]): DescriptionItem => ({ label, value }))} />
          </CardBody>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">The sender&apos;s IP address is stored only as a salted hash, for abuse limits. Requests are deleted after 24 months.</p>
        </Card>
      </div>
    </>
  );
}
