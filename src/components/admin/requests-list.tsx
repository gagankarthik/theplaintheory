import { Badge, type BadgeTone } from "@/components/app/ui/badge";
import { STATUS_LABEL, SUPPORT_SEVERITIES, TOPIC_LABEL, categoryLabel, labelOf } from "@/lib/lead-options";
import type { Lead, LeadStatus, LeadTopic } from "@/lib/types";

/** New needs a first look (info), open is waiting on us (amber), closed is done (neutral). */
const STATUS_TONE: Record<LeadStatus, BadgeTone> = { new: "info", open: "warning", closed: "neutral" };

export function LeadStatusBadge({ status }: { status: LeadStatus | undefined }) {
  const s = status ?? "new";
  return <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>;
}

export function LeadTopicBadge({ topic }: { topic: LeadTopic | undefined }) {
  return <Badge tone="neutral">{TOPIC_LABEL[topic ?? "sales"]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Lead["severity"] }) {
  if (!severity) return null;
  const tone: BadgeTone = severity === "urgent" ? "danger" : severity === "high" ? "warning" : "neutral";
  return <Badge tone={tone}>{labelOf(SUPPORT_SEVERITIES, severity)}</Badge>;
}

/** One line that says what the request is about. */
export function leadSummary(l: Lead) {
  const topic = l.topic ?? "sales";
  if (l.subject) return l.subject;
  if (topic === "sales") return `${l.sites ?? "?"} sites, ${l.pageviews ?? "?"} pageviews`;
  return categoryLabel(topic, l.category) || "Request";
}
