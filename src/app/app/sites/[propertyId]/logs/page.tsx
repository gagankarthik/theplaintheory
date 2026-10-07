import type { Metadata } from "next";
import Link from "next/link";
import { LogsTable, VerifyChainButton } from "@/components/app/logs/logs-table";
import { relativeTime, utcShort } from "@/components/app/logs/receipt-labels";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink, buttonClass } from "@/components/app/ui/button";
import { IconDownload, IconReceipt } from "@/components/icons";
import { formatInt, formatPct, isoDaysAgo, outcomeOf } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { planById } from "@/lib/plans";
import { filterQuery, filterRange, hasFieldFilters, hasFilters, matchesReceipt, parseReceiptFilters } from "@/lib/receipt-filters";
import { Select } from "@/components/app/ui/select";
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
  const plan = planById(org.plan);
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
        ? `on ${filters.from}`
        : `${filters.from} to ${filters.to}`
      : filters.from
        ? `since ${filters.from}`
        : `up to ${filters.to}`
    : `last ${STATS_DAYS} days`;
  const check = property.lastChainCheck;
  const chain: Stat = !chainSize
    ? { label: "Chain", value: "—", note: "Starts with the first receipt" }
    : !check
      ? { label: "Chain", value: "Not verified", note: `${formatInt(chainSize)} receipts to check` }
      : check.ok
        ? {
            label: "Chain",
            value: "Intact",
            tone: "good",
            note: (
              <>
                {formatInt(check.checked)} of {formatInt(chainSize)} receipts,{" "}
                <time dateTime={check.at} title={utcShort(check.at)}>
                  {relativeTime(check.at)}
                </time>
              </>
            ),
          }
        : {
            label: "Chain",
            value: `Broken at #${formatInt(check.brokenAt ?? 0)}`,
            tone: "bad",
            note: (
              <>
                Found{" "}
                <time dateTime={check.at} title={utcShort(check.at)}>
                  {relativeTime(check.at)}
                </time>
                . Export the log and contact support.
              </>
            ),
          };
  const stats: Stat[] = [
    {
      label: `Receipts, ${period}`,
      value: formatInt(inRange.length),
      note: inRange.length ? `${formatInt(withdrawals)} withdrawal${withdrawals === 1 ? "" : "s"}` : "None yet",
    },
    {
      label: "Opt-in rate",
      value: decisions.length ? formatPct(accepted / decisions.length) : "—",
      note: decisions.length ? `${formatInt(accepted)} of ${formatInt(decisions.length)} accepted all` : "No decisions yet",
    },
    {
      label: "GPC opt-outs",
      value: formatInt(gpc),
      note: decisions.length ? `of ${formatInt(decisions.length)} decisions, honoured` : "None yet",
      href: gpc ? withQuery("", { gpc: "1" }) : undefined,
    },
    chain,
  ];

  return (
    <>
      <PageHeader live={10_000}
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Consent log" }]}
        title="Consent log"
        description={`Every banner decision on ${property.domain}, hash-chained so any change shows. Kept ${formatInt(plan.logRetentionDays)} days.`}
        actions={
          canExport ? (
            <>
              <ButtonLink variant="ghost" href={`/app/sites/${property.id}/logs/report`}>
                <IconReceipt size={18} />
                Audit report
              </ButtonLink>
              <VerifyChainButton propertyId={property.id} />
              <a className={buttonClass("primary")} href={exportHref} download>
                <IconDownload size={18} />
                {filtered ? "Export filtered CSV" : "Export CSV"}
              </a>
            </>
          ) : null
        }
      />

      <StatStrip label={`Consent log, ${period}`} stats={stats} />

      <form method="get" aria-label="Filter consent receipts" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
        <div>
          <label htmlFor="f-action" className="label">
            Decision
          </label>
          <Select id="f-action" name="action" defaultValue={filters.action ?? ""} options={[{ value: "", label: "All decisions" }, ...DECISIONS.map((d) => ({ value: d.value, label: d.label }))]} />
        </div>
        <div>
          <label htmlFor="f-framework" className="label">
            Notice
          </label>
          <Select id="f-framework" name="framework" defaultValue={filters.framework ?? ""} options={[{ value: "", label: "All notices" }, ...Object.entries(FRAMEWORK_META).map(([k, v]) => ({ value: k, label: v.name }))]} />
        </div>
        <div>
          <label htmlFor="f-from" className="label">
            From (UTC)
          </label>
          <input id="f-from" name="from" type="date" defaultValue={filters.from} className="field h-10 w-full" />
        </div>
        <div>
          <label htmlFor="f-to" className="label">
            To (UTC)
          </label>
          <input id="f-to" name="to" type="date" defaultValue={filters.to} className="field h-10 w-full" />
        </div>
        <div>
          <label htmlFor="f-visitor" className="label">
            Visitor id
          </label>
          <input
            id="f-visitor"
            name="visitor"
            defaultValue={filters.visitor}
            placeholder="e.g. 3f9a1c0b2e"
            spellCheck={false}
            autoComplete="off"
            pattern="[a-fA-F0-9]{4,64}"
            title="The start of a visitor id: 4 to 64 hex characters"
            className="field h-10 w-full font-mono"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
          <label className="inline-flex h-10 items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="gpc" value="1" defaultChecked={filters.gpc} className="size-4 accent-[var(--color-brand)]" />
            GPC only
          </label>
          <button type="submit" className={buttonClass("ghost")}>
            Apply
          </button>
          {filtered ? (
            <Link href="?" className={buttonClass("quiet")}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>
      {capped ? (
        <p role="status" className="mb-4 text-sm text-ink-3">
          Searched the newest {formatInt(SCAN_CAP)} receipts in this range. Narrow the dates to search further back.
        </p>
      ) : null}

      <LogsTable
        propertyId={property.id}
        rows={page}
        empty={
          filtered ? (
            "No receipts match these filters."
          ) : (
            <>
              No receipts yet. Each visitor&apos;s choice on the banner is recorded here.{" "}
              <Link href={`/app/sites/${property.id}/install`} className="font-semibold text-brand hover:underline">
                Install the script
              </Link>{" "}
              and publish the banner to start.
            </>
          )
        }
        footer={
          <nav aria-label="Log pages" className="flex items-center justify-between gap-3">
            <span>
              Showing {page.length ? `#${formatInt(page[page.length - 1].seq)} to #${formatInt(page[0].seq)}` : "no receipts"}
            </span>
            <span className="flex gap-2">
              {before ? (
                <Link href={withQuery("")} className={buttonClass("ghost", "sm")}>
                  Newest
                </Link>
              ) : null}
              {hasMore ? (
                <Link href={withQuery("", { before: String(page[page.length - 1].seq) })} className={buttonClass("ghost", "sm")}>
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
