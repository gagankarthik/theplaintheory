import type { Metadata } from "next";
import Link from "next/link";
import { LogsTable, VerifyChain } from "@/components/app/logs/logs-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink, buttonClass } from "@/components/app/ui/button";
import { IconDownload, IconReceipt } from "@/components/icons";
import { formatInt } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { planById } from "@/lib/plans";

export const metadata: Metadata = { title: "Consent log" };

const PAGE = 50;

export default async function LogsPage(props: PageProps<"/app/sites/[propertyId]/logs">) {
  const { propertyId } = await props.params;
  const sp = await props.searchParams;
  const before = Number(typeof sp.before === "string" ? sp.before : "") || undefined;
  const { property, store, role, org } = await requireProperty(propertyId);

  const rows = await store.listReceipts(property.id, { limit: PAGE + 1, before });
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const canExport = can(role, "logs:export");
  const plan = planById(org.plan);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Consent log" }]}
        title="Consent log"
        description={`Every banner decision on ${property.domain}, newest first. Each receipt includes the hash of the one before it, so a changed or deleted record breaks the chain. Kept for ${formatInt(plan.logRetentionDays)} days on your plan.`}
        actions={
          canExport ? (
            <>
              <ButtonLink variant="ghost" href={`/app/sites/${property.id}/logs/report`}>
                <IconReceipt size={18} />
                Audit report
              </ButtonLink>
              <a className={buttonClass("primary")} href={`/api/app/logs/${property.id}/export`} download>
                <IconDownload size={18} />
                Export CSV
              </a>
            </>
          ) : null
        }
      />

      {canExport ? (
        <div className="mb-6">
          <VerifyChain propertyId={property.id} />
        </div>
      ) : null}

      <LogsTable
        rows={page}
        footer={
          <nav aria-label="Log pages" className="flex items-center justify-between gap-3">
            <span>
              Showing {page.length ? `#${formatInt(page[page.length - 1].seq)} to #${formatInt(page[0].seq)}` : "no receipts"}
            </span>
            <span className="flex gap-2">
              {before ? (
                <Link href="?" className={buttonClass("ghost", "sm")}>
                  Newest
                </Link>
              ) : null}
              {hasMore ? (
                <Link href={`?before=${page[page.length - 1].seq}`} className={buttonClass("ghost", "sm")}>
                  Older receipts
                </Link>
              ) : null}
            </span>
          </nav>
        }
      />
    </>
  );
}
