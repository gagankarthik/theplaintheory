import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestMetrics } from "@/components/admin/request-metrics";
import { leadMetrics } from "@/lib/platform/lead-metrics";
import type { Lead } from "@/lib/types";

const NOW = Date.parse("2026-10-18T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const base = { name: "A", email: "a@example.test", ipHash: "x" };

describe("RequestMetrics", () => {
  it("renders the inbox, volume and breakdowns", () => {
    const leads: Lead[] = [
      { ...base, id: "lead_1", topic: "support", severity: "urgent", createdAt: ago(30) },
      { ...base, id: "lead_2", topic: "sales", sites: "2-10", pageviews: "100k-1m", regions: ["in"], status: "closed", createdAt: ago(10), updatedAt: ago(4) },
    ];
    const html = renderToStaticMarkup(<RequestMetrics m={leadMetrics(leads, NOW)} />);
    for (const s of ["New, unanswered", "Oldest waiting", "30 h", "Urgent or high support", "Median time to close", "6 h", "By topic", "1 waiting", "Sales: websites", "Visitor regions"]) expect(html).toContain(s);
    expect(html).toContain('href="/admin/requests?status=new&amp;topic=support"');
  });

  it("renders an empty inbox without errors", () => {
    const html = renderToStaticMarkup(<RequestMetrics m={leadMetrics([], NOW)} />);
    expect(html).toContain("Inbox zero");
    expect(html).toContain("None yet");
  });
});
