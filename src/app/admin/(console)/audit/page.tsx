import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState } from "@/components/app/ui/empty-state";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { verifyPlatformAuditChain } from "@/lib/platform/audit-chain";
import { getStore } from "@/lib/store";

export const generateMetadata = () => staffMetadata("Audit log");

const LIMIT = 500;

export default async function AdminAuditPage() {
  await requireStaff("platform:audit");
  const store = await getStore();
  const events = await store.listPlatformAudit();
  const chain = verifyPlatformAuditChain(events);
  const recent = events.slice(0, LIMIT);

  return (
    <>
      <PageHeader live
        title="Platform audit log"
        description="Every change Plain Theory staff made to customer accounts, staff roles and plans. Events are hash-chained, so an edited or deleted entry breaks verification."
        actions={
          events.length ? (
            chain.ok ? (
              <Badge tone="released">Chain verified, {chain.checked} events</Badge>
            ) : (
              <Badge tone="declined">Chain broken at event {chain.brokenAt}</Badge>
            )
          ) : null
        }
      />
      {events.length ? (
        <>
          {events.length > LIMIT ? <p className="mb-3 text-sm text-ink-3">Showing the newest {LIMIT} of {events.length} events.</p> : null}
          <AuditTable events={recent} />
        </>
      ) : (
        <EmptyState title="No staff actions yet">Plan changes, suspensions, unlocks, sign-outs and staff role changes are recorded here.</EmptyState>
      )}
    </>
  );
}
