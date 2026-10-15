import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState } from "@/components/app/ui/empty-state";
import { IconChain } from "@/components/icons";
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
      <PageHeader
        live
        title="Platform audit log"
        description="Every change Plain Theory staff made to customer accounts, staff roles and plans. Events are hash-chained, so an edited or deleted entry breaks verification."
        actions={
          events.length && chain.ok ? (
            <Badge tone="success">
              Chain verified, <span className="tabular-nums">{chain.checked.toLocaleString("en-GB")}</span> events
            </Badge>
          ) : null
        }
      />
      {events.length && !chain.ok ? (
        <Alert tone="danger" title={`Chain broken at event ${chain.brokenAt}`} className="mb-6">
          An entry at or after this point was changed or removed outside the console. Report it to engineering with the event number.
        </Alert>
      ) : null}
      {events.length ? (
        <>
          {events.length > LIMIT ? (
            <Alert className="mb-4">
              Showing the newest {LIMIT.toLocaleString("en-GB")} of {events.length.toLocaleString("en-GB")} events. The chain check covers all of them.
            </Alert>
          ) : null}
          <AuditTable events={recent} />
        </>
      ) : (
        <EmptyState icon={<IconChain size={22} />} title="No staff actions yet">
          Plan changes, suspensions, unlocks, sign-outs and staff role changes are recorded here.
        </EmptyState>
      )}
    </>
  );
}
