"use client";

import { useActionState, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { addTracker, removeTracker, updateTrackerCategory } from "@/app/app/sites/[propertyId]/actions";
import { approveTrackers, ignoreTrackers, restoreTracker } from "@/app/app/sites/[propertyId]/tracker-actions";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { Checkbox } from "@/components/app/ui/checkbox";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { DateText } from "@/components/app/ui/date-text";
import { DescriptionList } from "@/components/app/ui/description-list";
import { Dialog } from "@/components/app/ui/dialog";
import { EmptyState } from "@/components/app/ui/empty-state";
import { SelectField, TextField } from "@/components/app/ui/field";
import { Select } from "@/components/app/ui/select";
import { Sheet } from "@/components/app/ui/sheet";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { TabPanel, Tabs } from "@/components/app/ui/tabs";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { CATEGORY_ICONS, IconCheck, IconClose, IconCookie, IconPlus, IconRadar, IconSearch, IconTrash } from "@/components/icons";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { statusOf, suggested, type ScanStatus } from "@/lib/trackers";
import type { CategoryId, Tracker, TrackerKind, TrackerStatus } from "@/lib/types";
import { RISK_LABEL, riskOf, type RiskLevel, type TrackerFlags } from "./risk";

export interface ScanSummary {
  id: string;
  /** empty while a scan is queued or running */
  finishedAt: string;
  startedAt?: string;
  status: ScanStatus;
  engine?: "headless" | "fetch";
  error?: string;
  /** pages read */
  pages: number;
  findings: number;
  /** findings the database didn't know */
  unknown: number;
}

const CATEGORY_LABEL: Record<CategoryId, string> = { essential: "Essential", functional: "Preferences", analytics: "Analytics", marketing: "Marketing" };
const CATEGORY_HINT: Record<CategoryId, string> = {
  essential: "Always runs. Listed, never held.",
  functional: "Held until visitors allow preferences.",
  analytics: "Held until visitors allow analytics.",
  marketing: "Held until visitors allow marketing.",
};
const CATEGORY_OPTIONS = (["analytics", "marketing", "functional", "essential"] as const).map((c) => {
  const Icon = CATEGORY_ICONS[c];
  return { value: c as CategoryId, label: CATEGORY_LABEL[c], description: CATEGORY_HINT[c], icon: <Icon size={15} /> };
});
const MANUAL_OPTIONS = CATEGORY_OPTIONS.filter((o) => o.value !== "essential").map(({ value, label, icon }) => ({ value, label, icon }));

const KIND_LABEL: Record<TrackerKind, string> = { script: "Script", cookie: "Cookie", iframe: "Embed", pixel: "Pixel" };
const STORAGE_LABEL = { cookie: "Cookie", localStorage: "localStorage", sessionStorage: "sessionStorage" } as const;

/** Risk bar colours are graphics (3:1 is enough); the level is always written next to them in ink. */
const RISK_BAR: Record<RiskLevel, string> = { low: "text-risk-low", medium: "text-risk-medium", high: "text-risk-high", critical: "text-risk-critical" };
const RISK_BARS: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };

type Op = { type: "remove"; id: string } | { type: "category"; id: string; category: CategoryId } | { type: "status"; ids: string[]; status: TrackerStatus; category?: CategoryId };

type CategoryFilter = "all" | CategoryId | "unclassified";
type RiskFilter = "all" | "urgent" | RiskLevel;
type KindFilter = "all" | TrackerKind;
type PartyFilter = "all" | "first" | "third";

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  ...CATEGORY_OPTIONS.map((o) => ({ value: o.value as CategoryFilter, label: o.label })),
  { value: "unclassified", label: "Unclassified" },
];
const RISK_FILTERS: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "Any risk" },
  { value: "urgent", label: "High and critical" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const KIND_FILTERS: { value: KindFilter; label: string }[] = [{ value: "all", label: "All kinds" }, ...(Object.keys(KIND_LABEL) as TrackerKind[]).map((k) => ({ value: k as KindFilter, label: KIND_LABEL[k] }))];
const PARTY_FILTERS: { value: PartyFilter; label: string }[] = [
  { value: "all", label: "Any party" },
  { value: "first", label: "First party" },
  { value: "third", label: "Third party" },
];
const labelOf = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((o) => o.value === v)?.label ?? v;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "/pricing" from a full URL; "/" for the homepage */
function pathOf(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

/** Risk as text plus a 1–4 bar meter: the level reads by words and by bar count, never colour alone. */
function RiskMeter({ level }: { level: RiskLevel }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-ink">
      <span aria-hidden className={`flex items-end gap-0.5 ${RISK_BAR[level]}`}>
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className={`w-1 rounded-full bg-current ${b <= RISK_BARS[level] ? "" : "opacity-20"}`} style={{ height: 4 + b * 2 }} />
        ))}
      </span>
      <span className={level === "high" || level === "critical" ? "font-medium" : ""}>{RISK_LABEL[level]}</span>
    </span>
  );
}

/** Small mono flag, e.g. HttpOnly. */
function Flag({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span title={title} className="inline-flex h-5 items-center rounded-sm bg-raised px-1.5 font-mono text-xs text-ink-2 ring-1 ring-inset ring-line">
      {children}
    </span>
  );
}

function SourceBadge({ t }: { t: Tracker }) {
  const s = statusOf(t);
  // approved by a scan from the tracker database: a known vendor in its standard category
  if (s === "approved" && t.autoApproved)
    return (
      <Badge tone="success" icon={<IconCheck size={12} />}>
        Auto-categorized
      </Badge>
    );
  if (s === "approved")
    return (
      <Badge tone="success" icon={<IconCheck size={12} />}>
        Verified
      </Badge>
    );
  if (s === "ignored") return <Badge tone="neutral">Ignored</Badge>;
  if (t.source === "manual") return <Badge tone="neutral">Added by hand</Badge>;
  if (t.source === "traffic") return <Badge tone="warning">Seen in traffic</Badge>;
  return (
    <Badge tone="neutral" icon={<IconRadar size={12} />}>
      Auto-detected
    </Badge>
  );
}

/** An applied filter, removable on its own. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-selected pl-3 pr-2 text-xs font-medium text-on-selected ring-1 ring-inset ring-boundary transition-colors duration-150 hover:ring-ink max-sm:min-h-10"
    >
      {label}
      <IconClose size={12} aria-hidden />
      <span className="sr-only">, remove filter</span>
    </button>
  );
}

export function TrackersManager({
  propertyId,
  domain,
  trackers,
  lastScan,
  flags = {},
  canWrite,
  knownCount,
}: {
  propertyId: string;
  domain: string;
  trackers: Tracker[];
  /** the newest scan, for the "last scan" figure and the link to the scanner */
  lastScan?: ScanSummary | null;
  /** cookie flags from the newest headless scan, keyed by tracker pattern */
  flags?: Record<string, TrackerFlags>;
  canWrite: boolean;
  knownCount: number;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [optimistic, apply] = useOptimistic(trackers, (list: Tracker[], op: Op) => {
    if (op.type === "remove") return list.filter((t) => t.id !== op.id);
    if (op.type === "category") return list.map((t) => (t.id === op.id ? { ...t, category: op.category } : t));
    return list.map((t) => (op.ids.includes(t.id) ? { ...t, status: op.status, category: op.category ?? t.category } : t));
  });
  const run = (op: Op, action: () => Promise<ActionResult>) =>
    start(async () => {
      apply(op);
      const r = await action();
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) toast(r.ok);
    });

  const byStatus = (s: TrackerStatus) => optimistic.filter((t) => statusOf(t) === s);
  const review = byStatus("review");
  const approved = byStatus("approved");
  const ignored = byStatus("ignored");
  const ready = suggested(optimistic);

  const [tab, setTab] = useState<TrackerStatus>(review.length || !approved.length ? "review" : "approved");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [party, setParty] = useState<PartyFilter>("all");
  const [moreFilters, setMoreFilters] = useState(false);
  // Selection only spans what is on screen: it belongs to one tab + filter combination and resets when that changes.
  const view = [tab, query, category, riskFilter, kind, party].join("|");
  const [selection, setSelection] = useState<{ view: string; ids: Set<string> }>({ view, ids: new Set() });
  const selected = selection.view === view ? selection.ids : new Set<string>();
  const setSelected = (next: Set<string> | ((s: Set<string>) => Set<string>)) =>
    setSelection((cur) => {
      const base = cur.view === view ? cur.ids : new Set<string>();
      return { view, ids: typeof next === "function" ? next(base) : next };
    });
  const [bulkCategory, setBulkCategory] = useState<CategoryId | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Tracker | null>(null);
  const [detail, setDetail] = useState<Tracker | null>(null);

  const risk = (t: Tracker) => riskOf(t, flags[t.pattern]);
  const active = optimistic.filter((t) => statusOf(t) !== "ignored");
  const highRisk = active.filter((t) => ["high", "critical"].includes(risk(t))).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return optimistic
      .filter((t) => statusOf(t) === tab)
      .filter((t) => !q || `${t.name} ${t.pattern} ${t.vendor ?? ""}`.toLowerCase().includes(q))
      .filter((t) => category === "all" || (category === "unclassified" ? t.category === null : t.category === category))
      .filter((t) => {
        if (riskFilter === "all") return true;
        const r = riskOf(t, flags[t.pattern]);
        return riskFilter === "urgent" ? r === "high" || r === "critical" : r === riskFilter;
      })
      .filter((t) => kind === "all" || (t.kind ?? "script") === kind)
      .filter((t) => party === "all" || t.party === party)
      .sort((a, b) => RISK_ORDER[riskOf(a, flags[a.pattern])] - RISK_ORDER[riskOf(b, flags[b.pattern])] || a.name.localeCompare(b.name));
  }, [optimistic, tab, query, category, riskFilter, kind, party, flags]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = !allChecked && rows.some((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  // The bulk category belongs to one selection. Once the selection empties (after Approve, Ignore,
  // Clear, or unticking every row) it goes back to "Keep category", so a choice made for an earlier
  // batch can never silently overwrite the categories set row by row on the next one.
  const [lastSelected, setLastSelected] = useState(selected.size);
  if (selected.size !== lastSelected) {
    setLastSelected(selected.size);
    if (selected.size === 0 && bulkCategory) setBulkCategory(undefined);
  }
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectedIds = [...selected];

  const chips = [
    query.trim() ? { key: "q", label: `Search: ${query.trim()}`, clear: () => setQuery("") } : null,
    category !== "all" ? { key: "category", label: labelOf(CATEGORY_FILTERS, category), clear: () => setCategory("all") } : null,
    riskFilter !== "all" ? { key: "risk", label: `Risk: ${labelOf(RISK_FILTERS, riskFilter)}`, clear: () => setRiskFilter("all") } : null,
    kind !== "all" ? { key: "kind", label: labelOf(KIND_FILTERS, kind), clear: () => setKind("all") } : null,
    party !== "all" ? { key: "party", label: labelOf(PARTY_FILTERS, party), clear: () => setParty("all") } : null,
  ].filter((c): c is { key: string; label: string; clear: () => void } => c !== null);
  const filtersOn = chips.length > 0;
  const moreCount = (kind !== "all" ? 1 : 0) + (party !== "all" ? 1 : 0);
  const clearAll = () => {
    setQuery("");
    setCategory("all");
    setRiskFilter("all");
    setKind("all");
    setParty("all");
  };

  const approve = (t: Tracker) => {
    if (!t.category) return toast(`Choose a category for ${t.name} first.`, "error");
    run({ type: "status", ids: [t.id], status: "approved" }, () => approveTrackers(propertyId, [t.id]));
  };
  const ignore = (ids: string[]) => run({ type: "status", ids, status: "ignored" }, () => ignoreTrackers(propertyId, ids));
  const bulkApprove = () => {
    if (!selectedIds.length) return;
    run({ type: "status", ids: selectedIds, status: "approved", category: bulkCategory }, () => approveTrackers(propertyId, selectedIds, bulkCategory));
    setSelected(new Set());
  };
  const setCategoryOf = (t: Tracker, c: CategoryId) => run({ type: "category", id: t.id, category: c }, () => updateTrackerCategory(propertyId, t.id, c));

  const empty: Record<TrackerStatus, { title: string; body: string }> = {
    review: lastScan
      ? { title: "Nothing waiting for review", body: "New cookies, scripts and pixels from your next scan land here first." }
      : { title: "Scan your site to fill the catalog", body: `The scanner visits ${domain} in a real browser and lists every cookie, script, embed and pixel, matched against ${knownCount} known trackers.` },
    approved: { title: "No verified trackers yet", body: "Approve trackers from To review, or add one by hand. Verified trackers are held until visitors consent." },
    ignored: { title: "Nothing ignored", body: "Trackers you ignore stay here, so later scans don't suggest them again." },
  };

  const scanStat =
    lastScan?.status === "queued" || lastScan?.status === "running"
      ? { label: "Last scan", value: "Running", note: "Open the scanner to follow it", href: `/app/sites/${propertyId}/scanner` }
      : lastScan?.status === "failed"
        ? { label: "Last scan", value: "Failed", note: lastScan.finishedAt ? formatDate(lastScan.finishedAt) : "See the scanner", tone: "bad" as const, href: `/app/sites/${propertyId}/scanner` }
        : {
            label: "Last scan",
            value: lastScan?.finishedAt ? formatDate(lastScan.finishedAt) : "Never",
            note: lastScan ? `${plural(lastScan.pages, "page")}, ${lastScan.findings} found` : "Run the scanner",
            href: `/app/sites/${propertyId}/scanner`,
          };

  const columns: Column<Tracker>[] = [
    {
      id: "tracker",
      header: canWrite ? (
        <span className="flex items-center gap-3">
          <Checkbox
            id="sel-all"
            label={<span className="sr-only">Select all trackers shown</span>}
            checked={allChecked}
            aria-checked={someChecked ? "mixed" : allChecked}
            ref={(el: HTMLInputElement | null) => {
              if (el) el.indeterminate = someChecked;
            }}
            onChange={toggleAll}
            className="!min-h-0"
          />
          Tracker
        </span>
      ) : (
        "Tracker"
      ),
      mobileLabel: "Tracker",
      cell: (t) => (
        <span className="flex min-w-0 items-start gap-3">
          {canWrite ? <Checkbox id={`sel-${t.id}`} label={<span className="sr-only">Select {t.name}</span>} checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="!min-h-0 pt-0.5" /> : null}
          <button type="button" onClick={() => setDetail(t)} className="block min-w-0 max-w-64 rounded-sm text-left">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium text-ink underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-line-strong">{t.name}</span>
              <span className="shrink-0 text-xs text-ink-3">{KIND_LABEL[t.kind ?? "script"]}</span>
            </span>
            <span className="block truncate font-mono text-xs text-ink-3">{t.pattern}</span>
          </button>
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: (t) =>
        canWrite ? (
          <div className="w-44 max-sm:ml-auto">
            <Select<CategoryId>
              size="sm"
              aria-label={`Category for ${t.name}`}
              placeholder="Choose category"
              value={t.category ?? undefined}
              options={CATEGORY_OPTIONS}
              menuWidth={256}
              onValueChange={(c) => setCategoryOf(t, c)}
            />
          </div>
        ) : t.category ? (
          <span className="text-ink-2">{CATEGORY_LABEL[t.category]}</span>
        ) : (
          <span className="text-ink-3">Unclassified</span>
        ),
    },
    { id: "risk", header: "Risk", sortValue: (t) => 3 - RISK_ORDER[risk(t)], cell: (t) => <RiskMeter level={risk(t)} /> },
    {
      id: "vendor",
      header: "Vendor",
      hideOnMobile: true,
      sortValue: (t) => (t.vendor ?? "~").toLowerCase(),
      cell: (t) =>
        t.vendor ? (
          <span className="block max-w-48 truncate text-ink-2" title={t.purpose}>
            {t.vendor}
          </span>
        ) : (
          <span className="text-ink-3">{t.source === "scan" ? "Unknown" : "Not set"}</span>
        ),
    },
    {
      id: "flags",
      header: "Flags",
      hideOnMobile: true,
      cell: (t) => {
        const f = flags[t.pattern];
        return (
          <span className="flex flex-wrap gap-1">
            {t.party ? <Flag title="Who sets it">{t.party === "first" ? "1P" : "3P"}</Flag> : null}
            {f?.httpOnly ? <Flag title="HttpOnly: invisible to page scripts">HttpOnly</Flag> : null}
            {f?.secure ? <Flag title="Secure: sent over HTTPS only">Secure</Flag> : null}
            {f?.sameSite ? <Flag title="SameSite policy">{f.sameSite}</Flag> : null}
            {f?.storage && f.storage !== "cookie" ? <Flag title="Where it is stored">{STORAGE_LABEL[f.storage]}</Flag> : null}
            {(f?.expiry ?? t.expiry) ? <Flag title="Lifetime">{f?.expiry ?? t.expiry}</Flag> : null}
          </span>
        );
      },
    },
    {
      id: "found",
      header: "Found on",
      hideOnMobile: true,
      sortValue: (t) => t.pageCount ?? 0,
      cell: (t) =>
        t.pageCount ? (
          <span className="block min-w-0 whitespace-nowrap" title={t.foundOn?.join("\n")}>
            <span className="tabular-nums text-ink">{t.pageCount}</span>
            <span className="text-ink-3"> page{t.pageCount === 1 ? "" : "s"}</span>
            {t.foundOn?.[0] ? <span className="block max-w-36 truncate font-mono text-xs text-ink-3">{pathOf(t.foundOn[0])}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-ink-3">{t.source === "scan" ? "Not in last scan" : "Added by hand"}</span>
        ),
    },
    { id: "status", header: "Source", cell: (t) => <SourceBadge t={t} /> },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            mobileLabel: "Actions",
            align: "right" as const,
            cell: (t: Tracker) => <RowActions t={t} onApprove={approve} onRemove={setRemoving} onIgnore={(id) => ignore([id])} run={run} propertyId={propertyId} />,
          },
        ]
      : []),
  ];

  const tabItems = [
    { value: "review" as const, label: <TabLabel text="To review" count={review.length} /> },
    { value: "approved" as const, label: <TabLabel text="Verified" count={approved.length} /> },
    { value: "ignored" as const, label: <TabLabel text="Ignored" count={ignored.length} /> },
  ];

  return (
    <div className="space-y-6">
      <StatStrip
        label="Cookie catalog at a glance"
        className=""
        stats={[
          { label: "Verified", value: String(approved.length), note: `${approved.filter((t) => t.category && t.category !== "essential").length} held until consent` },
          {
            label: "To review",
            value: String(review.length),
            note: ready.length ? `${ready.length} with a suggested category` : review.length ? "Each needs a category" : "Nothing waiting",
            tone: review.length ? "warn" : undefined,
          },
          { label: "High risk", value: String(highRisk), note: "Third-party or long-lived tracking", tone: highRisk ? "bad" : undefined },
          scanStat,
        ]}
      />

      <section aria-labelledby="catalog-h" className="space-y-3">
        <h2 id="catalog-h" className="sr-only">
          Catalog
        </h2>
        <div className="-mx-3 sm:mx-0">
          <Tabs<TrackerStatus> label="Trackers by status" idBase="catalog" items={tabItems} value={tab} onChange={setTab} />
        </div>

        {/* Filters: search and the two filters people use most; the rest sit in a sheet */}
        <div role="search" aria-label="Filter trackers" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 sm:w-64">
            <IconSearch size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-ink-3" />
            <TextField id="catalog-q" label="Search trackers" hideLabel type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, host, vendor" controlClassName="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <div className="sm:w-44">
              <Select<CategoryFilter> aria-label="Filter by category" value={category} onValueChange={setCategory} options={CATEGORY_FILTERS} />
            </div>
            <div className="sm:w-44">
              <Select<RiskFilter> aria-label="Filter by risk" value={riskFilter} onValueChange={setRiskFilter} options={RISK_FILTERS} />
            </div>
          </div>
          <Button variant="secondary" onClick={() => setMoreFilters(true)} aria-haspopup="dialog">
            More filters{moreCount ? <span className="tabular-nums"> ({moreCount})</span> : null}
          </Button>
          {canWrite ? (
            <Button variant="secondary" className="sm:ml-auto" onClick={() => setAdding(true)}>
              <IconPlus size={15} aria-hidden />
              Add tracker
            </Button>
          ) : null}
        </div>

        {filtersOn ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
            {chips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
            ))}
            <Button variant="link" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        ) : null}

        {/* One bar under the filters: bulk actions while rows are selected, else the suggestion */}
        {canWrite && selectedIds.length ? (
          <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2.5">
            <span className="mr-2 text-sm font-medium tabular-nums" aria-live="polite">
              {selectedIds.length} selected
            </span>
            {tab !== "approved" ? (
              <>
                <div className="w-44">
                  <Select<CategoryId> size="sm" aria-label="Category for the selected trackers" placeholder="Keep category" value={bulkCategory} options={CATEGORY_OPTIONS} menuWidth={256} onValueChange={setBulkCategory} />
                </div>
                <Button size="sm" onClick={bulkApprove}>
                  <IconCheck size={14} aria-hidden /> Approve
                </Button>
              </>
            ) : null}
            {tab !== "ignored" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  ignore(selectedIds);
                  setSelected(new Set());
                }}
              >
                Ignore
              </Button>
            ) : null}
            <Button size="sm" variant="quiet" className="ml-auto" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        ) : canWrite && tab === "review" && ready.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink-2">
            <span>
              <span className="font-medium tabular-nums text-ink">{ready.length}</span> of {review.length} matched a known vendor and have a suggested category.
            </span>
            <Button
              size="sm"
              onClick={() =>
                run({ type: "status", ids: ready.map((t) => t.id), status: "approved" }, () =>
                  approveTrackers(
                    propertyId,
                    ready.map((t) => t.id),
                  ),
                )
              }
            >
              <IconCheck size={14} aria-hidden />
              Approve suggested
            </Button>
          </div>
        ) : null}

        <TabPanel idBase="catalog" value={tab}>
          {rows.length === 0 ? (
            <EmptyState
              icon={<IconCookie size={22} />}
              headingLevel={3}
              title={filtersOn ? "No trackers match these filters" : empty[tab].title}
              action={
                filtersOn ? (
                  <Button variant="secondary" onClick={clearAll}>
                    Clear all filters
                  </Button>
                ) : tab === "review" && !lastScan ? (
                  <ButtonLink href={`/app/sites/${propertyId}/scanner`}>
                    <IconRadar size={15} aria-hidden /> Open the scanner
                  </ButtonLink>
                ) : undefined
              }
            >
              {filtersOn ? "Remove a filter to see more." : empty[tab].body}
            </EmptyState>
          ) : (
            <DataTable<Tracker>
              rows={rows}
              columns={columns}
              caption={`Trackers ${tab === "review" ? "to review" : tab === "approved" ? "verified" : "ignored"}, highest risk first`}
              rowKey={(t) => t.id}
              isSelected={canWrite ? (t) => selected.has(t.id) : undefined}
              maxHeight="70dvh"
              minWidth={1040}
              footer={
                <>
                  {plural(rows.length, "tracker")}, highest risk first.{" "}
                  {tab === "review" ? "Nothing here is held until you approve it." : tab === "approved" ? "Changes take effect when you publish." : "Not held, and not suggested again by scans."}
                </>
              }
            />
          )}
        </TabPanel>
      </section>

      <Sheet
        open={moreFilters}
        onClose={() => setMoreFilters(false)}
        title="More filters"
        width={400}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={() => {
                setKind("all");
                setParty("all");
              }}
            >
              Reset
            </Button>
            <Button onClick={() => setMoreFilters(false)}>Show {plural(rows.length, "tracker")}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <SelectField<KindFilter> id="filter-kind" label="Kind" value={kind} onValueChange={setKind} options={KIND_FILTERS} />
          <SelectField<PartyFilter> id="filter-party" label="Who sets it" value={party} onValueChange={setParty} options={PARTY_FILTERS} hint="First party is your own domain." />
        </div>
      </Sheet>

      <Sheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description={detail ? <span className="font-mono text-xs">{detail.pattern}</span> : undefined}
        footer={
          detail && canWrite ? (
            <>
              {statusOf(detail) !== "ignored" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    ignore([detail.id]);
                    setDetail(null);
                  }}
                >
                  Ignore
                </Button>
              ) : null}
              {statusOf(detail) === "review" ? (
                <Button
                  onClick={() => {
                    approve(detail);
                    setDetail(null);
                  }}
                >
                  Approve
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {detail ? <TrackerDetail t={detail} flags={flags[detail.pattern]} /> : null}
      </Sheet>

      {canWrite ? (
        <Dialog open={adding} onClose={() => setAdding(false)} title="Add a tracker by hand" description="For scripts a scan can't see, such as ones loaded after sign-in." width={480}>
          <AddTrackerForm propertyId={propertyId} onDone={() => setAdding(false)} />
        </Dialog>
      ) : null}
      {canWrite ? (
        <ConfirmDialog
          open={removing !== null}
          onClose={() => setRemoving(null)}
          title={`Remove ${removing?.name ?? "tracker"}?`}
          description="It leaves the catalog and is no longer held: after you publish, it runs without consent unless another rule holds it. A later scan may suggest it again."
          confirmLabel="Remove tracker"
          pendingLabel="Removing"
          destructive
          onConfirm={async () => {
            if (!removing) return;
            const r = await removeTracker(propertyId, removing.id);
            if (r?.error) return { error: r.error };
            if (r?.ok) toast(r.ok);
          }}
        />
      ) : null}
    </div>
  );
}

function TabLabel({ text, count }: { text: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {text}
      <span className="rounded-full bg-raised px-1.5 text-xs font-medium tabular-nums text-ink-2 ring-1 ring-inset ring-line">{count}</span>
    </span>
  );
}

function TrackerDetail({ t, flags }: { t: Tracker; flags?: TrackerFlags }) {
  const items: [string, React.ReactNode][] = [
    ["Category", t.category ? CATEGORY_LABEL[t.category] : "Unclassified"],
    ["Risk", <RiskMeter key="r" level={riskOf(t, flags)} />],
    ["Kind", KIND_LABEL[t.kind ?? "script"]],
    ["Party", t.party ? (t.party === "first" ? "First party (your domain)" : "Third party") : "Unknown"],
    ["Vendor", t.vendor ?? "Unknown"],
    ["Lifetime", flags?.expiry ?? t.expiry ?? "Not recorded"],
    ["HttpOnly", flags?.httpOnly === undefined ? "Not recorded" : flags.httpOnly ? "Yes, scripts can't read it" : "No"],
    ["Secure", flags?.secure === undefined ? "Not recorded" : flags.secure ? "Yes, HTTPS only" : "No"],
    ["SameSite", flags?.sameSite ?? "Not recorded"],
    ["Stored in", flags?.storage ? STORAGE_LABEL[flags.storage] : "Not recorded"],
    ["Source", t.source === "manual" ? "Added by hand" : t.source === "traffic" ? "Seen in visitor traffic" : t.autoApproved ? "Found by a scan, categorized automatically (known vendor)" : "Found by a scan"],
    ["Last seen", t.seenAt ? <DateText key="s" iso={t.seenAt} mode="datetime" /> : "Not recorded"],
  ];
  return (
    <div className="space-y-6">
      {t.purpose ? <p className="text-sm leading-relaxed text-ink-2">{t.purpose}</p> : null}
      <DescriptionList layout="stacked" items={items.map(([label, value]) => ({ label, value }))} />
      {t.foundOn?.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Found on {plural(t.pageCount ?? t.foundOn.length, "page")}</h3>
          <ul className="space-y-1">
            {t.foundOn.map((u) => (
              <li key={u} className="truncate rounded-sm bg-raised px-2.5 py-1.5 font-mono text-xs text-ink-2">
                {u}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RowActions({
  t,
  onApprove,
  onRemove,
  onIgnore,
  run,
  propertyId,
}: {
  t: Tracker;
  onApprove: (t: Tracker) => void;
  onRemove: (t: Tracker) => void;
  onIgnore: (id: string) => void;
  run: (op: Op, action: () => Promise<ActionResult>) => void;
  propertyId: string;
}) {
  const s = statusOf(t);
  const remove = (
    <Button variant="danger-quiet" size="sm" aria-label={`Remove ${t.name}`} title="Remove" onClick={() => onRemove(t)}>
      <IconTrash size={15} aria-hidden />
    </Button>
  );
  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      {s === "review" ? (
        <>
          <Button variant="secondary" size="sm" aria-label={`Approve ${t.name}`} onClick={() => onApprove(t)}>
            Approve
          </Button>
          <Button variant="quiet" size="sm" aria-label={`Ignore ${t.name}`} onClick={() => onIgnore(t.id)}>
            Ignore
          </Button>
        </>
      ) : null}
      {s === "approved" ? (
        <>
          <Button variant="quiet" size="sm" aria-label={`Ignore ${t.name}`} onClick={() => onIgnore(t.id)}>
            Ignore
          </Button>
          {remove}
        </>
      ) : null}
      {s === "ignored" ? (
        <>
          <Button variant="secondary" size="sm" aria-label={`Restore ${t.name} to review`} onClick={() => run({ type: "status", ids: [t.id], status: "review" }, () => restoreTracker(propertyId, t.id))}>
            Restore
          </Button>
          {remove}
        </>
      ) : null}
    </div>
  );
}

function AddTrackerForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [state, action] = useActionState<ActionResult, FormData>(addTracker.bind(null, propertyId), null);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) {
      toast(state.ok);
      onDone();
    }
  }, [state, toast, onDone]);
  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField id="t-name" name="name" label="Name" placeholder="Microsoft Clarity" error={state?.fieldErrors?.name} />
      <TextField
        id="t-pattern"
        name="pattern"
        label="Script address contains"
        hint="A host or part of the address, e.g. clarity.ms"
        placeholder="clarity.ms"
        controlClassName="font-mono"
        error={state?.fieldErrors?.pattern}
      />
      <SelectField<CategoryId> id="t-category" name="category" label="Hold until consent to" defaultValue="analytics" options={MANUAL_OPTIONS} error={state?.fieldErrors?.category} />
      <FormMessage state={state && !state.fieldErrors && state.error ? state : null} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pending="Adding">Add tracker</SubmitButton>
      </div>
    </form>
  );
}
