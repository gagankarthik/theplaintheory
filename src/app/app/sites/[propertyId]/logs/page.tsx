import type { Metadata } from "next";
import Link from "next/link";
import { LogsTable, VerifyChainButton } from "@/components/app/logs/logs-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { ButtonAnchor, ButtonLink } from "@/components/app/ui/button";
import { Checkbox } from "@/components/app/ui/checkbox";
import { DateField } from "@/components/app/ui/date-field";
import { DateText } from "@/components/app/ui/date-text";
import { SelectField, TextField } from "@/components/app/ui/field";
import { FilterBar } from "@/components/app/ui/filter-bar";
import { Pagination } from "@/components/app/ui/pagination";
import { IconDownload, IconReceipt } from "@/components/icons";
import { isoDaysAgo, outcomeOf } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { effectiveRetentionDays } from "@/lib/retention-grace";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { filterQuery, filterRange, hasFieldFilters, hasFilters, matchesReceipt, parseReceiptFilters } from "@/lib/receipt-filters";
import { StatStrip, type Stat } from "@/components/app/ui/stat-strip";

export const metadata: Metadata = { title: "Consent log" };

const PAGE = 50;
/** the numbers row covers this many days unless the date filters pick a range */
const STATS_DAYS = 30;
/** most receipts read per page when filtering by decision, notice, visitor or GPC */
const SCAN_CAP = 20_000;

const DECISIONS = [
  { value: "accept_all", label: "Accepted all" },
  { value: "custom", label: "Chose some" },
  { value: "reject_all", label: "Rejected all" },
  { value: "revoke", label: "Withdrew" },
] as const;

export default async function LogsPage(props: PageProps<"/app/sites/[propertyId]/logs">) {
  const { propertyId } = await props.params;
  const sp = await props.searchParams;
  const before = Number(typeof sp.before === "string" ? sp.before : "") || undefined;
  const filters = parseReceiptFilters(sp);
  const { property, store, role, org } = await requireProperty(propertyId);

  // Dates narrow the key range; the other filters are applied to the receipts in it (newest first).
  const range = filterRange(filters);
  let rows;
  let capped = false;
  if (hasFieldFilters(filters)) {
    const scanned = await store.listReceipts(property.id, { ...range, before, limit: SCAN_CAP });
    capped = scanned.length === SCAN_CAP;
    rows = scanned.filter((r) => matchesReceipt(r, filters)).slice(0, PAGE + 1);
  } else {
    rows = await store.listReceipts(property.id, { ...range, limit: PAGE + 1, before });
  }
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const canExport = can(role, "logs:export");
  // Receipts in the chain: the newest sequence number, less any retired by retention.
  const [head] = !before && !hasFilters(filters) ? rows : await store.listReceipts(property.id, { limit: 1 });
  const chainSize = Math.max(0, (head?.seq ?? 0) - (property.retentionCheckpoint?.seq ?? 0));
  const fq = filterQuery(filters);
  const filtered = hasFilters(filters);
  const withQuery = (base: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ ...fq, ...extra }).toString();
    return q ? `${base}?${q}` : base || "?";
  };
  const exportHref = withQuery(`/api/app/logs/${property.id}/export`);

  // The numbers row describes the chosen dates (or the last 30 days), not the decision, notice,
  // visitor or GPC filters: an opt-in rate over "Rejected all" receipts would say nothing.
  const dated = Boolean(filters.from || filters.to);
  const inRange = await store.listReceipts(property.id, dated ? range : { from: isoDaysAgo(STATS_DAYS) });
  const decisions = inRange.filter((r) => outcomeOf(r.action));
  const accepted = decisions.filter((r) => r.action === "accept_all").length;
  const gpc = decisions.filter((r) => r.gpc).length;
  const withdrawals = inRange.filter((r) => r.action === "revoke").length;
  const period = dated
    ? filters.from && filters.to
      ? filters.from === filters.to
        ? `on ${formatDate(filters.from)}`
        : `${formatDate(filters.from)} to ${formatDate(filters.to)}`
      : filters.from
        ? `since ${formatDate(filters.from)}`
        : `up to ${formatDate(filters.to!)}`
    : `last ${STATS_DAYS} days`;
  const check = property.lastChainCheck;
  const chain: Stat = !chainSize
    ? { label: "Chain", value: "—", note: "Starts with the first receipt" }
    : !check
      ? { label: "Chain", value: "Not verified", note: `${formatNumber(chainSize)} receipts to check` }
      : check.ok
        ? {
            label: "Chain",
            value: "Intact",
            tone: "good",
            note: (
              <>
                {formatNumber(check.checked)} of {formatNumber(chainSize)} receipts, <DateText iso={check.at} mode="relative" />
              </>
            ),
          }
        : {
            label: "Chain",
            value: `Broken at #${formatNumber(check.brokenAt ?? 0)}`,
            tone: "bad",
            note: (
              <>
                Found <DateText iso={check.at} mode="relative" />. Export the log and contact support.
              </>
            ),
          };
  const stats: Stat[] = [
    {
      label: `Receipts, ${period}`,
      value: formatNumber(inRange.length),
      note: inRange.length ? `${formatNumber(withdrawals)} withdrawal${withdrawals === 1 ? "" : "s"}` : "None yet",
    },
    {
      label: "Opt-in rate",
      value: decisions.length ? formatPct(accepted / decisions.length) : "—",
      note: decisions.length ? `${formatNumber(accepted)} of ${formatNumber(decisions.length)} accepted all` : "No decisions yet",
    },
    {
      label: "GPC opt-outs",
      value: formatNumber(gpc),
      note: decisions.length ? `of ${formatNumber(decisions.length)} decisions, honoured` : "None yet",
      href: gpc ? withQuery("", { gpc: "1" }) : undefined,
    },
    chain,
  ];

  return (
    <>
      <PageHeader live={10_000}
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Consent log" }]}
        title="Consent log"
        description={`Every banner decision on ${property.domain}, hash-chained so any change shows. Kept ${formatNumber(effectiveRetentionDays(org))} days.`}
        actions={
          canExport ? (
            <>
              <ButtonAnchor href={exportHref} download>
                <IconDownload size={18} aria-hidden />
                {filtered ? "Export filtered CSV" : "Export CSV"}
              </ButtonAnchor>
              <ButtonLink variant="ghost" href={`/app/sites/${property.id}/logs/report`}>
                <IconReceipt size={18} aria-hidden />
                Audit report
              </ButtonLink>
              <VerifyChainButton propertyId={property.id} receipts={chainSize} />
            </>
          ) : null
        }
      />

      <StatStrip label={`Consent log, ${period}`} stats={stats} />

      <FilterBar label="Filter consent receipts" active={filtered}>
        <SelectField id="f-action" name="action" label="Decision" defaultValue={filters.action ?? ""} options={[{ value: "", label: "All decisions" }, ...DECISIONS.map((d) => ({ value: d.value, label: d.label }))]} />
        <SelectField
          id="f-framework"
          name="framework"
          label="Notice"
          defaultValue={filters.framework ?? ""}
          options={[{ value: "", label: "All notices" }, ...Object.entries(FRAMEWORK_META).map(([k, v]) => ({ value: k, label: v.name }))]}
        />
        <DateField id="f-from" name="from" label="From" defaultValue={filters.from} />
        <DateField id="f-to" name="to" label="To" defaultValue={filters.to} />
        <TextField
          id="f-visitor"
          name="visitor"
          label="Visitor id"
          defaultValue={filters.visitor}
          placeholder="e.g. 3f9a1c0b2e"
          spellCheck={false}
          autoComplete="off"
          pattern="[a-fA-F0-9]{4,64}"
          title="The start of a visitor id: 4 to 64 hex characters"
          controlClassName="font-mono"
        />
        <Checkbox id="f-gpc" name="gpc" value="1" label="GPC only" defaultChecked={filters.gpc} />
      </FilterBar>
      {capped ? (
        <Alert tone="info" className="mb-4">
          Searched the newest {formatNumber(SCAN_CAP)} receipts in this range. Narrow the dates to search further back.
        </Alert>
      ) : null}

      <LogsTable
        propertyId={property.id}
        rows={page}
        empty={
          filtered ? (
            "No receipts match these filters."
          ) : (
            <>
              No receipts yet. Each visitor&apos;s choice on the banner is recorded here
              {property.publishedVersion > 0 ? (
                <>
                  {" "}once the script is on your site.{" "}
                  <Link href={`/app/sites/${property.id}/install`} className="font-semibold text-brand hover:underline">
                    Install the script
                  </Link>
                </>
              ) : (
                <>
                  .{" "}
                  <Link href={`/app/sites/${property.id}/install`} className="font-semibold text-brand hover:underline">
                    Install the script
                  </Link>{" "}
                  and publish the banner to start.
                </>
              )}
            </>
          )
        }
        footer={
          <Pagination
            label="Log pages"
            showing={page.length ? `Showing ${formatNumber(page.length)} receipts, #${formatNumber(page[page.length - 1].seq)} to #${formatNumber(page[0].seq)}` : "Showing no receipts"}
            newestHref={before ? withQuery("") : null}
            olderHref={hasMore ? withQuery("", { before: String(page[page.length - 1].seq) }) : null}
          />
        }
      />
    </>
  );
}
