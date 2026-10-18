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
import { EmptyState } from "@/components/app/ui/empty-state";
import { FilterBar, type FilterChip } from "@/components/app/ui/filter-bar";
import { Pagination } from "@/components/app/ui/pagination";
import { IconDownload, IconLogs, IconReceipt } from "@/components/icons";
import { isoDaysAgo, outcomeOf } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { effectiveRetentionDays } from "@/lib/retention-grace";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { countWithdrawals } from "@/lib/withdrawals";
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
  const withdrawals = countWithdrawals(inRange);
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
                Found <DateText iso={check.at} mode="relative" />
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
      note: decisions.length ? `of ${formatNumber(decisions.length)} decisions, all honoured` : "None yet",
      href: gpc ? withQuery("", { gpc: "1" }) : undefined,
    },
    chain,
  ];

  // Each applied filter as a chip; its link is this page without that one filter.
  const without = (key: keyof typeof fq) => {
    const rest = { ...fq };
    delete rest[key];
    const q = new URLSearchParams(rest).toString();
    return q ? `?${q}` : "?";
  };
  const chips: FilterChip[] = [
    filters.action ? { label: `Decision: ${DECISIONS.find((d) => d.value === filters.action)?.label ?? filters.action}`, href: without("action") } : null,
    filters.framework ? { label: `Notice: ${FRAMEWORK_META[filters.framework].name}`, href: without("framework") } : null,
    filters.from ? { label: `From ${formatDate(filters.from)}`, href: without("from") } : null,
    filters.to ? { label: `To ${formatDate(filters.to)}`, href: without("to") } : null,
    filters.visitor ? { label: `Visitor ${filters.visitor}`, href: without("visitor") } : null,
    filters.gpc ? { label: "GPC only", href: without("gpc") } : null,
  ].filter((c): c is FilterChip => c !== null);
  const installHref = `/app/sites/${property.id}/install`;
  const noReceipts = page.length === 0 && !filtered && !before;

  return (
    <>
      <PageHeader
        live={10_000}
        title="Consent log"
        description={
          <>
            Every banner decision on {property.domain}, hash-chained and kept {formatNumber(effectiveRetentionDays(org))} days.{" "}
            <Link href="/security" className="font-medium text-ink underline underline-offset-2 hover:no-underline">
              How the chain works
            </Link>
          </>
        }
        actions={
          canExport ? (
            <>
              <ButtonLink variant="quiet" href={`/app/sites/${property.id}/logs/report`}>
                <IconReceipt size={18} aria-hidden />
                Audit report
              </ButtonLink>
              <ButtonAnchor variant="secondary" href={exportHref} download>
                <IconDownload size={18} aria-hidden />
                {filtered ? "Export filtered CSV" : "Export CSV"}
              </ButtonAnchor>
              <VerifyChainButton propertyId={property.id} receipts={chainSize} />
            </>
          ) : null
        }
      />

      {check && !check.ok ? (
        <Alert tone="danger" title={`Chain broken at receipt #${formatNumber(check.brokenAt ?? 0)}`} className="mb-6">
          A record was changed or removed after it was written. Export the log as it stands and contact support.
        </Alert>
      ) : null}

      <StatStrip label={`Consent log, ${period}`} stats={stats} />

      {noReceipts ? (
        <EmptyState
          icon={<IconLogs size={24} />}
          title="No receipts yet"
          action={
            <ButtonLink href={installHref}>
              Install the script
            </ButtonLink>
          }
        >
          {property.publishedVersion > 0
            ? "Each visitor's choice on the banner is recorded here once the script is on your site."
            : "Install the script and publish the banner. Each visitor's choice is then recorded here, hash-chained."}
        </EmptyState>
      ) : (
        <>
          <FilterBar label="Filter consent receipts" active={filtered} chips={chips}>
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
                <>
                  No receipts match these filters.{" "}
                  <Link href="?" className="font-medium text-ink underline underline-offset-2 hover:no-underline">
                    Clear all
                  </Link>
                </>
              ) : (
                "No older receipts."
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
      )}
    </>
  );
}
