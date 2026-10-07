"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { addTracker, removeTracker, updateTrackerCategory } from "@/app/app/sites/[propertyId]/actions";
import { approveTrackers, ignoreTrackers, restoreTracker, scanTrackers } from "@/app/app/sites/[propertyId]/tracker-actions";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { Card, CardHeader } from "@/components/app/ui/card";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { DateText } from "@/components/app/ui/date-text";
import { Dialog } from "@/components/app/ui/dialog";
import { SelectField, TextField } from "@/components/app/ui/field";
import { PageSection } from "@/components/app/ui/page-section";
import { Select } from "@/components/app/ui/select";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { TabPanel, Tabs } from "@/components/app/ui/tabs";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { CATEGORY_ICONS, IconAlert, IconCheck, IconChevronDown, IconClock, IconPlus, IconScan, IconTrash } from "@/components/icons";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { statusOf, suggested } from "@/lib/trackers";
import type { CategoryId, Tracker, TrackerStatus } from "@/lib/types";

export interface ScanSummary {
  id: string;
  finishedAt: string;
  status: "ok" | "failed";
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

const KIND_LABEL: Record<NonNullable<Tracker["kind"]>, string> = { script: "Script", cookie: "Cookie", iframe: "Embed", pixel: "Pixel" };

type Op = { type: "remove"; id: string } | { type: "category"; id: string; category: CategoryId } | { type: "status"; ids: string[]; status: TrackerStatus; category?: CategoryId };

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

export function TrackersManager({
  propertyId,
  domain,
  trackers,
  scans,
  canWrite,
  knownCount,
}: {
  propertyId: string;
  domain: string;
  trackers: Tracker[];
  scans: ScanSummary[];
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
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Tracker | null>(null);

  const approve = (t: Tracker) => {
    if (!t.category) return toast(`Choose a category for ${t.name} first.`, "error");
    run({ type: "status", ids: [t.id], status: "approved" }, () => approveTrackers(propertyId, [t.id]));
  };

  const columns: Column<Tracker>[] = [
    {
      id: "name",
      header: "Tracker",
      sortValue: (t) => t.name.toLowerCase(),
      cell: (t) => (
        <>
          <span className="font-semibold">{t.name}</span>
          {t.kind && t.kind !== "script" ? <span className="ml-1.5 text-xs text-ink-3">{KIND_LABEL[t.kind]}</span> : null}
          <span className="block break-all font-mono text-xs text-ink-3">{t.pattern}</span>
        </>
      ),
    },
    {
      id: "vendor",
      header: "Vendor",
      sortValue: (t) => (t.vendor ?? "~").toLowerCase(),
      cell: (t) =>
        t.vendor ? (
          <span className="block max-w-[15rem] text-left">
            <span className="text-ink">{t.vendor}</span>
            {t.purpose ? <span className="block text-xs leading-snug text-ink-3">{t.purpose}</span> : null}
          </span>
        ) : (
          <span className="text-ink-3">{t.source === "scan" ? "Unknown" : "Not set"}</span>
        ),
    },
    {
      id: "category",
      header: "Category",
      sortValue: (t) => t.category ?? "~",
      cell: (t) => {
        if (canWrite) {
          return (
            <div className="w-44 max-sm:ml-auto">
              <Select<CategoryId>
                size="sm"
                aria-label={`Category for ${t.name}`}
                placeholder="Choose category"
                value={t.category ?? undefined}
                options={CATEGORY_OPTIONS}
                menuWidth={256}
                onValueChange={(category) => run({ type: "category", id: t.id, category }, () => updateTrackerCategory(propertyId, t.id, category))}
              />
            </div>
          );
        }
        if (!t.category) return <span className="text-ink-3">Unclassified</span>;
        const Icon = CATEGORY_ICONS[t.category];
        return (
          <Badge tone="neutral" icon={<Icon size={14} />}>
            {CATEGORY_LABEL[t.category]}
          </Badge>
        );
      },
    },
    {
      id: "party",
      header: "Party",
      sortValue: (t) => t.party ?? "~",
      cell: (t) => (t.party ? <Badge tone="neutral">{t.party === "first" ? "First party" : "Third party"}</Badge> : <span className="text-ink-3">–</span>),
    },
    {
      id: "found",
      header: "Found on",
      sortValue: (t) => t.pageCount ?? -1,
      cell: (t) =>
        t.pageCount ? (
          <span className="block min-w-0">
            <span className="tabular-nums">
              {t.pageCount} page{t.pageCount === 1 ? "" : "s"}
            </span>
            {t.foundOn?.[0] ? (
              <span className="block max-w-[12rem] truncate font-mono text-xs text-ink-3 max-sm:ml-auto" title={t.foundOn.join("\n")}>
                {pathOf(t.foundOn[0])}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-ink-3">{t.source === "scan" ? "Not seen in last scan" : "Added by hand"}</span>
        ),
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            mobileLabel: "Actions",
            align: "right" as const,
            cell: (t: Tracker) => <RowActions t={t} onApprove={approve} onRemove={setRemoving} run={run} propertyId={propertyId} />,
          },
        ]
      : []),
  ];

  const lastScan = scans[0];
  const tabs: { value: TrackerStatus; label: string; rows: Tracker[] }[] = [
    { value: "review", label: "To review", rows: review },
    { value: "approved", label: "Approved", rows: approved },
    { value: "ignored", label: "Ignored", rows: ignored },
  ];
  const heldCount = approved.filter((t) => t.category && t.category !== "essential").length;

  const empty: Record<TrackerStatus, string> = {
    review: lastScan ? "Nothing to review. New trackers from your next scan appear here." : "Scan your site to find trackers. What we find waits here for you to approve or ignore.",
    approved: "No approved trackers yet. Approve suggestions from To review, or add one by hand.",
    ignored: "Nothing ignored. Trackers you ignore stay here so later scans don't suggest them again.",
  };
  const footer: Record<TrackerStatus, string> = {
    review: "Nothing here is held until you approve it.",
    approved: "Changes take effect when you publish.",
    ignored: "Not held, and not suggested again by scans.",
  };
  const lastOk = scans.find((s) => s.status === "ok");

  return (
    <div className="space-y-8">
      <StatStrip
        label="Tracker inventory at a glance"
        className=""
        stats={[
          { label: "Approved", value: String(approved.length), note: `${heldCount} held until consent` },
          {
            label: "To review",
            value: String(review.length),
            note: ready.length ? `${ready.length} with a suggested category` : review.length ? "Each needs a category" : "Nothing waiting",
            tone: review.length ? "warn" : undefined,
          },
          { label: "Ignored", value: String(ignored.length), note: "Not suggested again" },
          lastScan?.status === "failed"
            ? { label: "Last scan", value: "Failed", note: formatDate(lastScan.finishedAt), tone: "bad" as const }
            : {
                label: "Last scan",
                value: lastOk ? formatDate(lastOk.finishedAt) : "No scan yet",
                note: lastOk ? `${plural(lastOk.pages, "page")} read, ${lastOk.findings} found${lastOk.unknown ? ` (${lastOk.unknown} unknown)` : ""}` : "Scan to find trackers",
              },
        ]}
      />

      <ScanCard propertyId={propertyId} domain={domain} scans={scans} canWrite={canWrite} knownCount={knownCount} onScanned={(added) => added > 0 && setTab("review")} />

      <PageSection
        id="inventory"
        title="Tracker inventory"
        description="Approve what you use, ignore what you don't. Only approved trackers are published."
        actions={
          canWrite ? (
            <>
              {tab === "review" && ready.length ? (
                <Button
                  variant="ghost"
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
                  <IconCheck size={16} aria-hidden />
                  Approve all suggested ({ready.length})
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <IconPlus size={16} aria-hidden />
                Add manually
              </Button>
            </>
          ) : null
        }
      >
        <div>
          <Tabs<TrackerStatus>
            idBase="trk"
            label="Trackers by status"
            value={tab}
            onChange={setTab}
            items={tabs.map((t) => ({
              value: t.value,
              label: (
                <>
                  {t.label} <span className="ml-0.5 tabular-nums text-ink-3">({t.rows.length})</span>
                </>
              ),
            }))}
          />
          {tabs
            .filter((t) => t.value === tab)
            .map((t) => (
              <TabPanel key={t.value} idBase="trk" value={t.value}>
                <div className="pt-4">
                  {t.value === "review" && ready.length ? (
                    <p className="mb-3 text-sm text-ink-2">
                      {ready.length} of {review.length} matched a known vendor and have a suggested category. Check them, then approve. The rest need a category from you.
                    </p>
                  ) : null}
                  <DataTable
                    caption={`${t.label} trackers`}
                    rows={t.rows}
                    columns={columns}
                    rowKey={(r) => r.id}
                    initialSort={{ id: "name", dir: "ascending" }}
                    // an empty table needs no sideways scroll; rows need room for the category picker
                    minWidth={!t.rows.length ? 0 : canWrite ? 960 : 760}
                    empty={empty[t.value]}
                    footer={t.rows.length ? footer[t.value] : undefined}
                  />
                </div>
              </TabPanel>
            ))}
        </div>
      </PageSection>

      <ScanHistory scans={scans} />

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

function RowActions({
  t,
  onApprove,
  onRemove,
  run,
  propertyId,
}: {
  t: Tracker;
  onApprove: (t: Tracker) => void;
  onRemove: (t: Tracker) => void;
  run: (op: Op, action: () => Promise<ActionResult>) => void;
  propertyId: string;
}) {
  const s = statusOf(t);
  const ignore = () => run({ type: "status", ids: [t.id], status: "ignored" }, () => ignoreTrackers(propertyId, [t.id]));
  const remove = (
    <Button variant="danger-quiet" size="sm" aria-label={`Remove ${t.name}`} title="Remove" onClick={() => onRemove(t)}>
      <IconTrash size={16} aria-hidden />
      <span className="sm:sr-only">Remove</span>
    </Button>
  );
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {s === "review" ? (
        <>
          <Button variant="ghost" size="sm" aria-label={`Approve ${t.name}`} onClick={() => onApprove(t)}>
            Approve
          </Button>
          <Button variant="quiet" size="sm" aria-label={`Ignore ${t.name}`} onClick={ignore}>
            Ignore
          </Button>
        </>
      ) : null}
      {s === "approved" ? (
        <>
          <Button variant="quiet" size="sm" aria-label={`Ignore ${t.name}`} onClick={ignore}>
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

function ScanCard({
  propertyId,
  domain,
  scans,
  canWrite,
  knownCount,
  onScanned,
}: {
  propertyId: string;
  domain: string;
  scans: ScanSummary[];
  canWrite: boolean;
  knownCount: number;
  onScanned: (added: number) => void;
}) {
  const [scanning, startScan] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const last = scans[0];
  // a failed latest scan shows its reason until the next run
  const shownError = error ?? (last?.status === "failed" ? (last.error ?? "The last scan failed.") : null);

  const scan = () =>
    startScan(async () => {
      setError(null);
      const r = await scanTrackers(propertyId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const n = r.report.findings.length;
      toast(`Scan finished: ${n} item${n === 1 ? "" : "s"} found, ${r.added} new to review.`);
      onScanned(r.added);
    });

  return (
    <Card aria-labelledby="scan-h">
      <CardHeader
        titleId="scan-h"
        title={`Scan ${domain}`}
        description={`We read up to 10 pages of your site and check every script, embed, pixel and cookie against ${knownCount} known trackers. Takes up to 25 seconds.`}
        divider={false}
        actions={
          canWrite ? (
            <Button loading={scanning} loadingLabel="Scanning" onClick={scan} className="max-sm:w-full">
              <IconScan size={18} aria-hidden />
              Scan now
            </Button>
          ) : null
        }
      />
      <div aria-live="polite">
        {scanning ? (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-2 sm:px-6">Reading your pages. New trackers will appear under To review.</p>
        ) : shownError ? (
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <Alert tone="danger" title="The scan didn't finish.">
              {shownError}
            </Alert>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ScanHistory({ scans }: { scans: ScanSummary[] }) {
  if (!scans.length) return null;
  return (
    <Card as="div">
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-3 text-sm font-semibold group-open:rounded-b-none hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <IconClock size={16} className="text-ink-3" aria-hidden />
            Scan history
            <span className="font-normal text-ink-3">(last {scans.length})</span>
          </span>
          <IconChevronDown size={16} className="text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ol className="divide-y divide-line border-t border-line">
          {scans.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
              <DateText iso={s.finishedAt} mode="datetime" className="tabular-nums text-ink-2" />
              {s.status === "ok" ? (
                <span className="text-ink-2">
                  {s.pages} page{s.pages === 1 ? "" : "s"} read, {s.findings} found{s.unknown ? `, ${s.unknown} unknown` : ""}
                </span>
              ) : (
                <span className="flex items-start gap-1.5 text-ink-2">
                  <IconAlert size={16} className="mt-0.5 shrink-0 text-rose" aria-hidden />
                  <span>
                    <span className="font-medium text-ink">Failed:</span> {s.error ?? "Unknown error."}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </details>
    </Card>
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
