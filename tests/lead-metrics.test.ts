import { describe, expect, it } from "vitest";
import { leadMetrics, shortDuration } from "@/lib/platform/lead-metrics";
import type { Lead } from "@/lib/types";

const NOW = Date.parse("2026-10-18T12:00:00Z");
const H = 3_600_000;
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString();
const lead = (p: Partial<Lead>): Lead => ({ id: `lead_${Math.random()}`, name: "A", email: "a@example.test", ipHash: "x", createdAt: at(1), ...p });

describe("leadMetrics", () => {
  const leads = [
    lead({ createdAt: at(50) }), // legacy: no topic (sales), no status (new)
    lead({ topic: "support", severity: "urgent", status: "open", createdAt: at(5) }),
    lead({ topic: "support", severity: "low", status: "closed", createdAt: at(10), updatedAt: at(6) }),
    lead({ topic: "sales", sites: "11-50", pageviews: "1m-10m", regions: ["eu", "us"], status: "closed", createdAt: at(30), updatedAt: at(28) }),
    lead({ topic: "enterprise", regions: ["eu"], createdAt: at(24 * 40) }),
  ];
  const m = leadMetrics(leads, NOW);

  it("counts inbox state, treating missing status as new and missing topic as sales", () => {
    expect([m.total, m.unanswered, m.open, m.closed]).toEqual([5, 2, 1, 2]);
    expect(m.topics.find((t) => t.topic === "sales")).toMatchObject({ total: 2, waiting: 1 });
    expect(m.oldestWaitingMs).toBe(24 * 40 * H);
  });

  it("measures urgency, volume and time to close", () => {
    expect(m.urgentOpen).toBe(1);
    expect([m.last30, m.prev30]).toEqual([4, 1]);
    expect(m.medianCloseMs).toBe(3 * H);
    expect(m.days).toHaveLength(30);
    expect(m.days.reduce((s, d) => s + d.total, 0)).toBe(4);
  });

  it("breaks down prospects and regions", () => {
    expect(m.salesSites.find((b) => b.key === "11-50")?.count).toBe(1);
    expect(m.regions.find((b) => b.key === "eu")?.count).toBe(2);
    expect(m.supportSeverity.find((b) => b.key === "urgent")?.count).toBe(1);
    expect(shortDuration(3 * H)).toBe("3 h");
    expect(shortDuration(72 * H)).toBe("3 d");
  });
});
