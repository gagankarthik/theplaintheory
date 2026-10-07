import "server-only";
import { id } from "../crypto";
import { runChecks } from "./checks";
import { crawlSite } from "./crawl";
import { summarize, type SiteAuditReport } from "./types";

/** Crawl a site's public pages and check what visitors see. Never throws for site problems. */
export async function auditLiveSite(input: { propertyId: string; domain: string; runBy?: string }): Promise<SiteAuditReport> {
  const startedAt = new Date();
  const crawl = await crawlSite(input.domain);
  const { checks, notices } = runChecks({ domain: input.domain, home: crawl.home, pages: crawl.pages, visits: crawl.visits });
  const finishedAt = new Date();
  return {
    id: id("sad", 8),
    propertyId: input.propertyId,
    domain: input.domain,
    homeUrl: crawl.home?.url ?? null,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    pages: crawl.visits,
    notices: [...crawl.notices, ...notices],
    checks,
    summary: summarize(checks),
    runBy: input.runBy,
  };
}

export type { SiteAuditReport, SiteCheck, SiteCheckStatus } from "./types";
