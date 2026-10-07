import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/app/ui/badge";
import { STATUS_LABEL, SUPPORT_SEVERITIES, TOPIC_LABEL, categoryLabel, labelOf, leadReference } from "@/lib/lead-options";
import type { Lead, LeadStatus, LeadTopic } from "@/lib/types";
import { fmtDateTime } from "./format";

const STATUS_TONE: Record<LeadStatus, BadgeTone> = { new: "brand", open: "held", closed: "neutral" };

export function LeadStatusBadge({ status }: { status: LeadStatus | undefined }) {
  const s = status ?? "new";
  return <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>;
}

export function LeadTopicBadge({ topic }: { topic: LeadTopic | undefined }) {
  return <Badge tone="neutral">{TOPIC_LABEL[topic ?? "sales"]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Lead["severity"] }) {
  if (!severity) return null;
  const tone: BadgeTone = severity === "urgent" ? "declined" : severity === "high" ? "held" : "neutral";
  return <Badge tone={tone}>{labelOf(SUPPORT_SEVERITIES, severity)}</Badge>;
}

/** One line that says what the request is about. */
export function leadSummary(l: Lead) {
  const topic = l.topic ?? "sales";
  if (l.subject) return l.subject;
  if (topic === "sales") return `${l.sites ?? "?"} sites, ${l.pageviews ?? "?"} pageviews`;
  return categoryLabel(topic, l.category) || "Request";
}

/**
 * The inbox, newest first: a table from sm up, stacked cards below. Rendered on the server; filters
 * are links, so the list works without JavaScript.
 */
export function RequestsList({ leads }: { leads: Lead[] }) {
  return (
    <div className="panel overflow-hidden">
      <ul className="divide-y divide-line sm:hidden" aria-label="Requests">
        {leads.map((l) => (
          <li key={l.id} className="relative px-4 py-3.5">
            <Link href={`/admin/requests/${l.id}`} className="block text-sm font-bold after:absolute after:inset-0 after:content-[''] hover:underline">
              {leadSummary(l)}
            </Link>
            <p className="mt-0.5 truncate text-xs text-ink-3">
              {l.name} · {l.company ?? l.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <LeadStatusBadge status={l.status} />
              <LeadTopicBadge topic={l.topic} />
              <SeverityBadge severity={l.severity} />
              <span className="text-xs text-ink-3">{fmtDateTime(l.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Contact requests, newest first</caption>
          <thead className="border-b border-line bg-paper text-xs text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Request
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                From
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Topic
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Received
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((l) => (
              <tr key={l.id} className="relative transition-colors hover:bg-paper">
                <td className="max-w-[34ch] px-4 py-3">
                  <Link href={`/admin/requests/${l.id}`} className="block truncate font-bold after:absolute after:inset-0 after:content-[''] hover:underline">
                    {leadSummary(l)}
                  </Link>
                  <span className="block font-mono text-xs text-ink-3">{leadReference(l.id)}</span>
                </td>
                <td className="max-w-[28ch] px-4 py-3">
                  <span className="block truncate text-ink-2">{l.name}</span>
                  <span className="block truncate text-xs text-ink-3">{l.company ?? l.email}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    <LeadTopicBadge topic={l.topic} />
                    <SeverityBadge severity={l.severity} />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <LeadStatusBadge status={l.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">
                  <time dateTime={l.createdAt}>{fmtDateTime(l.createdAt)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A row of filter links (status or topic). The current one carries aria-current. */
export function FilterLinks({ label, options, current, href }: { label: string; options: { value: string; label: string }[]; current: string; href: (value: string) => string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-ink-3">{label}</span>
      {options.map((o) => {
        const on = o.value === current;
        return (
          <Link
            key={o.value}
            href={href(o.value)}
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors max-sm:h-11 ${on ? "bg-brand-wash font-medium text-brand-ink ring-1 ring-inset ring-brand/30" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:text-ink hover:ring-ink/30"}`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
