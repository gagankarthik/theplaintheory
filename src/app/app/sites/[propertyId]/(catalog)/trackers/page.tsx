import type { Metadata } from "next";
import { LearnMore } from "@/components/app/configure/learn-more";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink } from "@/components/app/ui/button";
import { flagsFrom } from "@/components/app/trackers/risk";
import { TrackersManager, type ScanSummary } from "@/components/app/trackers/trackers-manager";
import { IconRadar } from "@/components/icons";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { TRACKER_DB } from "@/lib/tracker-db";

export const metadata: Metadata = { title: "Cookie catalog" };

export default async function TrackersPage(props: PageProps<"/app/sites/[propertyId]/trackers">) {
  const { propertyId } = await props.params;
  const { property, role, store } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  const scans = await store.listScans(property.id, 5);
  const last = scans[0];
  const lastScan: ScanSummary | null = last
    ? {
        id: last.id,
        finishedAt: last.finishedAt,
        startedAt: last.startedAt,
        status: last.status,
        engine: last.engine,
        error: last.error,
        pages: last.pages.filter((p) => p.status !== null && p.status < 400).length,
        findings: last.findings.length,
        unknown: last.findings.filter((f) => f.category === null).length,
      }
    : null;
  // Cookie flags (HttpOnly, Secure, SameSite, storage) only come from headless scans: use the newest one that finished.
  const headless = scans.find((s) => s.status === "ok" && s.engine === "headless");
  return (
    <>
      <PageHeader
        title="Cookie catalog"
        description={
          <>
            Every cookie, script, embed and pixel on your site. Verified trackers wait for consent. <LearnMore anchor="blocking" topic="blocking trackers" />
          </>
        }
        actions={
          canWrite ? (
            <ButtonLink href={`/app/sites/${property.id}/scanner`} variant="secondary">
              <IconRadar size={16} aria-hidden />
              Scanner
            </ButtonLink>
          ) : undefined
        }
      />
      <TrackersManager
        propertyId={property.id}
        domain={property.domain}
        trackers={property.trackers}
        lastScan={lastScan}
        flags={headless ? flagsFrom(headless.findings) : {}}
        canWrite={canWrite}
        knownCount={TRACKER_DB.length}
      />
    </>
  );
}
