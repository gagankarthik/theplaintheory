"use client";

import { useActionState, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { addTracker, removeTracker, updateTrackerCategory } from "@/app/app/sites/[propertyId]/actions";
import { approveTrackers, ignoreTrackers, restoreTracker } from "@/app/app/sites/[propertyId]/tracker-actions";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { DateText } from "@/components/app/ui/date-text";
import { Dialog } from "@/components/app/ui/dialog";
import { EmptyState } from "@/components/app/ui/empty-state";
import { SelectField, TextField } from "@/components/app/ui/field";
import { Select } from "@/components/app/ui/select";
import { Sheet } from "@/components/app/ui/sheet";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { Segmented } from "@/components/app/ui/tabs";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { CATEGORY_ICONS, IconCheck, IconCookie, IconPlus, IconRadar, IconSearch, IconTrash } from "@/components/icons";
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

const RISK_TONE: Record<RiskLevel, string> = {
  low: "text-jade bg-jade-wash",
  medium: "text-amber bg-amber-wash",
  high: "text-[color:var(--color-risk-high)] bg-[color-mix(in_srgb,var(--color-risk-high)_12%,transparent)]",
  critical: "text-rose bg-rose-wash",
};
const RISK_BARS: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

type Op = { type: "remove"; id: string } | { type: "category"; id: string; category: CategoryId } | { type: "status"; ids: string[]; status: TrackerStatus; category?: CategoryId };

type CategoryFilter = "all" | CategoryId | "unclassified";
type KindFilter = "all" | TrackerKind;
type PartyFilter = "all" | "first" | "third";

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

function RiskMeter({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-[6px] px-1.5 text-[0.75rem] font-medium ${RISK_TONE[level]}`}>
      <span aria-hidden className="flex items-end gap-[2px]">
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className={`w-[3px] rounded-[1px] bg-current ${b <= RISK_BARS[level] ? "" : "opacity-25"}`} style={{ height: 3 + b * 2 }} />
        ))}
      </span>
      {RISK_LABEL[level]}
    </span>
  );
}

/** Small mono flag, e.g. HttpOnly. */
function Flag({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span title={title} className="inline-flex h-5 items-center rounded-[4px] bg-paper px-1.5 font-mono text-[0.6875rem] text-ink-2 ring-1 ring-inset ring-line">
      {children}
    </span>
  );
}

function SourceBadge({ t }: { t: Tracker }) {
  const s = statusOf(t);
  if (s === "approved")
    return (
      <Badge tone="success" icon={<IconCheck size={12} />}>
        Verified
      </Badge>
    );
  if (s === "ignored") return <Badge tone="neutral">Ignored</Badge>;
  if (t.source === "manual") return <Badge tone="info">Added by hand</Badge>;
  if (t.source === "traffic") return <Badge tone="warning">Seen in traffic</Badge>;
  return (
    <Badge tone="brand" icon={<IconRadar size={12} />}>
      Auto-detected
    </Badge>
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
  const [kind, setKind] = useState<KindFilter>("all");
  const [party, setParty] = useState<PartyFilter>("all");
  // Selection only spans what is on screen: it belongs to one tab + filter combination and resets when that changes.
  const view = [tab, query, category, kind, party].join("|");
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
    const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return optimistic
      .filter((t) => statusOf(t) === tab)
      .filter((t) => !q || `${t.name} ${t.pattern} ${t.vendor ?? ""}`.toLowerCase().includes(q))
      .filter((t) => category === "all" || (category === "unclassified" ? t.category === null : t.category === category))
      .filter((t) => kind === "all" || (t.kind ?? "script") === kind)
      .filter((t) => party === "all" || t.party === party)
      .sort((a, b) => order[riskOf(a, flags[a.pattern])] - order[riskOf(b, flags[b.pattern])] || a.name.localeCompare(b.name));
  }, [optimistic, tab, query, category, kind, party, flags]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectedIds = [...selected];
  const filtersOn = query !== "" || category !== "all" || kind !== "all" || party !== "all";

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

  const empty: Record<TrackerStatus, { title: string; body: string }> = {
    review: lastScan
      ? { title: "Nothing waiting for review", body: "New cookies, scripts and pixels from your next scan land here first." }
      : { title: "Scan your site to fill the catalog", body: `The scanner visits ${domain} in a real browser and lists every cookie, script, embed and pixel it sees, matched against ${knownCount} known trackers.` },
    approved: { title: "No verified trackers yet", body: "Approve suggestions from To review, or add one by hand. Verified trackers are held until visitors consent to their category." },
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

  return (
    <div className="space-y-6">
      <StatStrip
        label="Cookie catalog at a glance"
        className=""
        stats={[
          { label: "Verified", value: String(approved.length), note: `${approved.filter((t) => t.category && t.category !== "essential").length} held until consent`, tone: approved.length ? "good" : undefined },
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

      <section aria-labelledby="catalog-h" className="panel overflow-hidden">
        <h2 id="catalog-h" className="sr-only">
          Catalog
        </h2>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
          <Segmented<TrackerStatus>
            label="Trackers by status"
            value={tab}
            onChange={setTab}
            options={[
              { value: "review", label: <>To review <span className="font-mono text-ink-3">{review.length}</span></> },
              { value: "approved", label: <>Verified <span className="font-mono text-ink-3">{approved.length}</span></> },
              { value: "ignored", label: <>Ignored <span className="font-mono text-ink-3">{ignored.length}</span></> },
            ]}
          />
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
            <label className="relative min-w-0 flex-1 basis-48 lg:max-w-64">
              <span className="sr-only">Search trackers</span>
              <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, host, vendor" className="field h-8 pl-8 text-[0.8125rem]" />
            </label>
            <div className="w-36">
              <Select<CategoryFilter>
                size="sm"
                aria-label="Filter by category"
                value={category}
                onValueChange={setCategory}
                options={[
                  { value: "all", label: "All categories" },
                  ...CATEGORY_OPTIONS.map((o) => ({ value: o.value as CategoryFilter, label: o.label, icon: o.icon })),
                  { value: "unclassified", label: "Unclassified" },
                ]}
              />
            </div>
            <div className="w-32">
              <Select<KindFilter>
                size="sm"
                aria-label="Filter by kind"
                value={kind}
                onValueChange={setKind}
                options={[{ value: "all", label: "All kinds" }, ...(Object.keys(KIND_LABEL) as TrackerKind[]).map((k) => ({ value: k as KindFilter, label: KIND_LABEL[k] }))]}
              />
            </div>
            <div className="w-32">
              <Select<PartyFilter>
                size="sm"
                aria-label="Filter by party"
                value={party}
                onValueChange={setParty}
                options={[
                  { value: "all", label: "Any party" },
                  { value: "first", label: "First party" },
                  { value: "third", label: "Third party" },
                ]}
              />
            </div>
            {filtersOn ? (
              <button
                type="button"
                className="btn btn-link text-xs"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setKind("all");
                  setParty("all");
                }}
              >
                Clear
              </button>
            ) : null}
            {canWrite ? (
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <IconPlus size={15} aria-hidden />
                Add
              </Button>
            ) : null}
          </div>
        </div>

        {/* Suggestions and bulk actions */}
        {canWrite && tab === "review" && ready.length && !selectedIds.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand-wash/50 px-4 py-2.5 text-[0.8125rem] text-ink-2">
            <span>
              <span className="font-medium text-ink">{ready.length}</span> of {review.length} matched a known vendor and have a suggested category.
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
        {canWrite && selectedIds.length ? (
          <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 border-b border-line bg-inverse px-4 py-2 text-[0.8125rem] text-on-inverse">
            <span className="mr-1 font-mono">{selectedIds.length} selected</span>
            {tab !== "approved" ? (
              <>
                <div className="w-40">
                  <Select<CategoryId> size="sm" aria-label="Category for the selected trackers" placeholder="Keep category" value={bulkCategory} options={CATEGORY_OPTIONS} menuWidth={256} onValueChange={setBulkCategory} />
                </div>
                <button type="button" onClick={bulkApprove} className="btn btn-sm bg-brand-solid text-white">
                  <IconCheck size={14} aria-hidden /> Approve
                </button>
              </>
            ) : null}
            {tab !== "ignored" ? (
              <button
                type="button"
                onClick={() => {
                  ignore(selectedIds);
                  setSelected(new Set());
                }}
                className="btn btn-sm text-on-inverse ring-1 ring-inset ring-current/30 hover:bg-white/10"
              >
                Ignore
              </button>
            ) : null}
            <button type="button" onClick={() => setSelected(new Set())} className="btn btn-sm ml-auto text-on-inverse/80 hover:text-on-inverse">
              Clear selection
            </button>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            bare
            icon={<IconCookie size={22} />}
            title={filtersOn ? "No trackers match these filters" : empty[tab].title}
            action={
              !filtersOn && tab === "review" && !lastScan ? (
                <ButtonLink href={`/app/sites/${propertyId}/scanner`}>
                  <IconRadar size={15} aria-hidden /> Open the scanner
                </ButtonLink>
              ) : undefined
            }
          >
            {filtersOn ? "Clear a filter to see more." : empty[tab].body}
          </EmptyState>
        ) : (
          <>
            {/* Phones: stacked cards */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((t) => (
                <li key={t.id} className="space-y-2.5 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setDetail(t)} className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
                      <span className="block truncate font-mono text-xs text-ink-3">{t.pattern}</span>
                    </button>
                    <RiskMeter level={risk(t)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SourceBadge t={t} />
                    {t.party ? <Flag title="Who sets it">{t.party === "first" ? "1st party" : "3rd party"}</Flag> : null}
                    <Flag title="Kind">{KIND_LABEL[t.kind ?? "script"]}</Flag>
                  </div>
                  {canWrite ? (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select<CategoryId>
                          size="sm"
                          aria-label={`Category for ${t.name}`}
                          placeholder="Choose category"
                          value={t.category ?? undefined}
                          options={CATEGORY_OPTIONS}
                          menuWidth={256}
                          onValueChange={(c) => run({ type: "category", id: t.id, category: c }, () => updateTrackerCategory(propertyId, t.id, c))}
                        />
                      </div>
                      <RowActions t={t} onApprove={approve} onRemove={setRemoving} onIgnore={(id) => ignore([id])} run={run} propertyId={propertyId} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            {/* Tablets and up: the table */}
            <div className="relative hidden overflow-x-auto md:block" role="region" aria-label={`${tab} trackers`} tabIndex={0}>
              <table className="w-full min-w-[980px] text-left text-sm">
                <caption className="sr-only">Trackers, {tab}, sorted by risk</caption>
                <thead className="border-b border-line bg-raised text-xs text-ink-3">
                  <tr>
                    {canWrite ? (
                      <th scope="col" className="w-10 pl-4">
                        <input type="checkbox" aria-label="Select all" checked={allChecked} onChange={toggleAll} className="size-4 cursor-pointer accent-[var(--color-brand-solid)]" />
                      </th>
                    ) : null}
                    <th scope="col" className="h-9 px-3 font-medium">
                      Tracker
                    </th>
                    <th scope="col" className="px-3 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-3 font-medium">
                      Risk
                    </th>
                    <th scope="col" className="px-3 font-medium">
                      Vendor
                    </th>
                    <th scope="col" className="px-3 font-medium">
                      Flags
                    </th>
                    <th scope="col" className="whitespace-nowrap px-3 font-medium">
                      Found on
                    </th>
                    <th scope="col" className="px-3 font-medium">
                      Status
                    </th>
                    {canWrite ? (
                      <th scope="col" className="pr-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((t) => {
                    const f = flags[t.pattern];
                    const on = selected.has(t.id);
                    return (
                      <tr key={t.id} className={`group transition-colors ${on ? "bg-brand-wash/40" : "hover:bg-raised"}`}>
                        {canWrite ? (
                          <td className="pl-4">
                            <input type="checkbox" aria-label={`Select ${t.name}`} checked={on} onChange={() => toggle(t.id)} className="size-4 cursor-pointer accent-[var(--color-brand-solid)]" />
                          </td>
                        ) : null}
                        <td className="max-w-[16rem] px-3 py-2.5">
                          <button type="button" onClick={() => setDetail(t)} className="block max-w-full text-left">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{t.name}</span>
                              <span className="shrink-0 text-[0.6875rem] text-ink-3">{KIND_LABEL[t.kind ?? "script"]}</span>
                            </span>
                            <span className="block truncate font-mono text-[0.75rem] text-ink-3">{t.pattern}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          {canWrite ? (
                            <div className="w-40">
                              <Select<CategoryId>
                                size="sm"
                                aria-label={`Category for ${t.name}`}
                                placeholder="Choose category"
                                value={t.category ?? undefined}
                                options={CATEGORY_OPTIONS}
                                menuWidth={256}
                                onValueChange={(c) => run({ type: "category", id: t.id, category: c }, () => updateTrackerCategory(propertyId, t.id, c))}
                              />
                            </div>
                          ) : t.category ? (
                            <Badge tone="neutral">{CATEGORY_LABEL[t.category]}</Badge>
                          ) : (
                            <span className="text-ink-3">Unclassified</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <RiskMeter level={riskOf(t, f)} />
                        </td>
                        <td className="max-w-[13rem] px-3 py-2.5">
                          {t.vendor ? (
                            <span className="block truncate text-ink-2" title={t.purpose}>
                              {t.vendor}
                            </span>
                          ) : (
                            <span className="text-ink-3">{t.source === "scan" ? "Unknown" : "Not set"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex flex-wrap gap-1">
                            {t.party ? <Flag title="Who sets it">{t.party === "first" ? "1P" : "3P"}</Flag> : null}
                            {f?.httpOnly ? <Flag title="HttpOnly: invisible to page scripts">HttpOnly</Flag> : null}
                            {f?.secure ? <Flag title="Secure: sent over HTTPS only">Secure</Flag> : null}
                            {f?.sameSite ? <Flag title="SameSite policy">{f.sameSite}</Flag> : null}
                            {f?.storage && f.storage !== "cookie" ? <Flag title="Where it is stored">{STORAGE_LABEL[f.storage]}</Flag> : null}
                            {(f?.expiry ?? t.expiry) ? <Flag title="Lifetime">{f?.expiry ?? t.expiry}</Flag> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {t.pageCount ? (
                            <span className="block min-w-0 whitespace-nowrap" title={t.foundOn?.join("\n")}>
                              <span className="font-mono text-[0.8125rem] tabular-nums text-ink">{t.pageCount}</span>
                              <span className="text-ink-3"> page{t.pageCount === 1 ? "" : "s"}</span>
                              {t.foundOn?.[0] ? <span className="block max-w-[9rem] truncate font-mono text-[0.6875rem] text-ink-3">{pathOf(t.foundOn[0])}</span> : null}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-3">{t.source === "scan" ? "Not in last scan" : "Added by hand"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <SourceBadge t={t} />
                        </td>
                        {canWrite ? (
                          <td className="py-2.5 pr-4 text-right">
                            <RowActions t={t} onApprove={approve} onRemove={setRemoving} onIgnore={(id) => ignore([id])} run={run} propertyId={propertyId} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line bg-raised px-4 py-2.5 text-xs text-ink-3">
              {tab === "review" ? "Nothing here is held until you approve it." : tab === "approved" ? "Changes take effect when you publish." : "Not held, and not suggested again by scans."}{" "}
              Showing {plural(rows.length, "tracker")}, highest risk first.
            </p>
          </>
        )}
      </section>

      <Sheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description={detail ? <span className="font-mono text-xs">{detail.pattern}</span> : undefined}
        footer={
          detail && canWrite ? (
            <>
              {statusOf(detail) === "review" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    approve(detail);
                    setDetail(null);
                  }}
                >
                  Approve
                </Button>
              ) : null}
              {statusOf(detail) !== "ignored" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    ignore([detail.id]);
                    setDetail(null);
                  }}
                >
                  Ignore
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
          description="It leaves the inventory and is no longer held: after you publish, it runs without consent unless another rule holds it. A later scan may suggest it again."
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

function TrackerDetail({ t, flags }: { t: Tracker; flags?: TrackerFlags }) {
  const rows: [string, React.ReactNode][] = [
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
    ["Source", t.source === "manual" ? "Added by hand" : t.source === "traffic" ? "Seen in visitor traffic" : "Found by a scan"],
    ["Last seen", t.seenAt ? <DateText key="s" iso={t.seenAt} mode="datetime" /> : "Not recorded"],
  ];
  return (
    <div className="space-y-6">
      {t.purpose ? <p className="text-sm leading-relaxed text-ink-2">{t.purpose}</p> : null}
      <dl className="divide-y divide-line rounded-lg border border-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-3.5 py-2.5">
            <dt className="text-ink-3">{k}</dt>
            <dd className="min-w-0 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {t.foundOn?.length ? (
        <div>
          <p className="eyebrow mb-2">Found on {plural(t.pageCount ?? t.foundOn.length, "page")}</p>
          <ul className="space-y-1">
            {t.foundOn.map((u) => (
              <li key={u} className="truncate rounded-[6px] bg-paper px-2.5 py-1.5 font-mono text-xs text-ink-2">
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
    <div className="flex justify-end gap-1">
      {s === "review" ? (
        <>
          <Button variant="ghost" size="sm" aria-label={`Approve ${t.name}`} onClick={() => onApprove(t)}>
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
          <Button variant="ghost" size="sm" aria-label={`Restore ${t.name} to review`} onClick={() => run({ type: "status", ids: [t.id], status: "review" }, () => restoreTracker(propertyId, t.id))}>
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
