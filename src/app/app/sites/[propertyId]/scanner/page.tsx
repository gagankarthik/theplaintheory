import type { Metadata } from "next";
import { ScannerConsole, type ScanHistoryRow } from "@/components/app/scanner/scanner-console";
import { PageHeader } from "@/components/app/shell/page-header";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { activeScan, CRAWL_LIMITS, crawlerMode } from "@/lib/crawler";

export const metadata: Metadata = { title: "Scanner" };

export default async function ScannerPage(props: PageProps<"/app/sites/[propertyId]/scanner">) {
  const { propertyId } = await props.params;
  const { property, role, store } = await requireProperty(propertyId);
  const [running, scans] = await Promise.all([activeScan(property.id), store.listScans(property.id, 20)]);
  const history: ScanHistoryRow[] = scans.map((s) => ({
    id: s.id,
    status: s.status,
    engine: s.engine ?? "fetch",
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    pages: s.progress?.pagesScanned ?? s.pages.filter((p) => p.status !== null && p.status < 400).length,
    findings: s.findings.length,
    unknown: s.findings.filter((f) => f.category === null).length,
    preConsent: s.preConsent?.length ?? 0,
    error: s.error,
  }));
  return (
    <>
      <PageHeader eyebrow="Configure" title="Scanner" description="Find out what your site sets before visitors consent. Findings go to the cookie catalog for review." />
      <ScannerConsole
        propertyId={property.id}
        domain={property.domain}
        mode={crawlerMode()}
        limits={CRAWL_LIMITS}
        canWrite={can(role, "property:write")}
        initial={running ?? scans[0] ?? null}
        history={history}
      />
    </>
  );
}
