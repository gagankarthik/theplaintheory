"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { addScannedTrackers, addTracker, removeTracker, scanSite, updateTrackerCategory } from "@/app/app/sites/[propertyId]/actions";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { SelectField, TextField } from "@/components/app/ui/field";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { CATEGORY_ICONS, IconScan, IconTrash } from "@/components/icons";
import type { ActionResult } from "@/lib/action-result";
import type { ScanResult } from "@/lib/scan";
import type { Tracker } from "@/lib/types";

type Category = Tracker["category"];
const CATEGORIES: { value: Exclude<Category, "essential">; label: string }[] = [
  { value: "analytics", label: "Analytics" },
  { value: "marketing", label: "Marketing" },
  { value: "functional", label: "Preferences" },
];
const labelOf = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

type Op = { type: "remove"; id: string } | { type: "category"; id: string; category: Category };

export function TrackersManager({ propertyId, trackers, canWrite }: { propertyId: string; trackers: Tracker[]; canWrite: boolean }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [optimistic, apply] = useOptimistic(trackers, (list: Tracker[], op: Op) =>
    op.type === "remove" ? list.filter((t) => t.id !== op.id) : list.map((t) => (t.id === op.id ? { ...t, category: op.category } : t)),
  );
  const run = (op: Op, action: () => Promise<ActionResult>) =>
    start(async () => {
      apply(op);
      const r = await action();
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) toast(r.ok);
    });

  const columns: Column<Tracker>[] = [
    {
      id: "name",
      header: "Tracker",
      sortValue: (t) => t.name.toLowerCase(),
      cell: (t) => (
        <>
          <span className="font-bold">{t.name}</span>
          <span className="block break-all font-mono text-xs text-ink-3">{t.pattern}</span>
        </>
      ),
    },
    {
      id: "category",
      header: "Held until consent to",
      mobileLabel: "Held until consent to",
      sortValue: (t) => t.category,
      cell: (t) => {
        const Icon = CATEGORY_ICONS[t.category];
        return canWrite ? (
          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Category for {t.name}</span>
            <Icon size={16} className="text-ink-3" />
            <select
              className="field h-9 w-auto py-0 pr-8 text-sm max-sm:h-11"
              value={t.category}
              onChange={(e) => run({ type: "category", id: t.id, category: e.target.value as Category }, () => updateTrackerCategory(propertyId, t.id, e.target.value as Category))}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Badge tone="held" icon={<Icon size={14} />}>
            {labelOf(t.category)}
          </Badge>
        );
      },
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            mobileLabel: "Actions",
            align: "right" as const,
            cell: (t: Tracker) => (
              <Button variant="quiet" size="sm" aria-label={`Remove ${t.name}`} onClick={() => run({ type: "remove", id: t.id }, () => removeTracker(propertyId, t.id))}>
                <IconTrash size={16} />
                <span className="sm:sr-only">Remove</span>
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-10">
      {canWrite ? <Scanner propertyId={propertyId} existing={trackers.map((t) => t.pattern)} /> : null}

      <section aria-labelledby="trackers-h" className="space-y-4">
        <div>
          <h2 id="trackers-h" className="text-lg font-bold">
            Held trackers
          </h2>
          <p className="text-sm text-ink-3">Scripts whose address contains a pattern below wait until the visitor consents to that category.</p>
        </div>
        <DataTable
          caption="Held trackers"
          rows={optimistic}
          columns={columns}
          rowKey={(t) => t.id}
          initialSort={{ id: "name", dir: "ascending" }}
          minWidth={560}
          empty="No trackers yet. Scan your site or add one below."
          footer={`${optimistic.length} tracker${optimistic.length === 1 ? "" : "s"}. Changes take effect when you publish.`}
        />
      </section>

      {canWrite ? <AddTrackerForm propertyId={propertyId} /> : null}
    </div>
  );
}

function AddTrackerForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(addTracker.bind(null, propertyId), null);
  return (
    <section aria-labelledby="add-tracker-h" className="border-t border-line pt-8">
      <h2 id="add-tracker-h" className="text-lg font-bold">
        Add a tracker by hand
      </h2>
      <p className="mb-5 text-sm text-ink-3">For scripts the scanner can&apos;t see, such as ones loaded after sign-in.</p>
      <form action={action} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_200px_auto] md:items-start" noValidate>
        <TextField id="t-name" name="name" label="Name" placeholder="Microsoft Clarity" error={state?.fieldErrors?.name} />
        <TextField id="t-pattern" name="pattern" label="Script address contains" placeholder="clarity.ms" controlClassName="font-mono" error={state?.fieldErrors?.pattern} />
        <SelectField id="t-category" name="category" label="Category" defaultValue="analytics" options={CATEGORIES} error={state?.fieldErrors?.category} />
        <div className="md:pt-[26px]">
          <SubmitButton pending="Adding" className="w-full md:w-auto">
            Add tracker
          </SubmitButton>
        </div>
      </form>
      <div className="mt-4">
        <FormMessage state={state && !state.fieldErrors ? state : null} />
      </div>
    </section>
  );
}

function Scanner({ propertyId, existing }: { propertyId: string; existing: string[] }) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scanning, startScan] = useTransition();
  const [adding, startAdd] = useTransition();
  const toast = useToast();
  const fresh = result?.ok ? result.found.filter((f) => !existing.includes(f.pattern)) : [];

  return (
    <section aria-labelledby="scan-h" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="scan-h" className="text-lg font-bold">
            Scan your site
          </h2>
          <p className="text-sm text-ink-3">We load your homepage and look for known analytics and ad scripts. Takes up to 8 seconds.</p>
        </div>
        <Button
          loading={scanning}
          loadingLabel="Scanning"
          onClick={() =>
            startScan(async () => {
              const r = await scanSite(propertyId);
              setResult(r);
              if (r.ok) setPicked(new Set(r.found.filter((f) => !existing.includes(f.pattern)).map((f) => f.pattern)));
            })
          }
        >
          <IconScan size={18} />
          Scan now
        </Button>
      </div>

      <div aria-live="polite">
        {result && !result.ok ? (
          <p role="alert" className="border-t border-line px-5 py-4 text-sm text-rose">
            {result.error}
          </p>
        ) : null}
        {result?.ok ? (
          <div className="border-t border-line px-5 py-4">
            <p className="mb-3 text-sm text-ink-2">
              Checked {result.scripts} script{result.scripts === 1 ? "" : "s"} on {result.url}.{" "}
              {result.found.length === 0
                ? "No known trackers found."
                : fresh.length === 0
                  ? "Every tracker found is already held."
                  : `${fresh.length} new tracker${fresh.length === 1 ? "" : "s"} found.`}
            </p>
            {fresh.length ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  startAdd(async () => {
                    const r = await addScannedTrackers(
                      propertyId,
                      fresh.filter((f) => picked.has(f.pattern)).map(({ name, category, pattern }) => ({ name, category, pattern })),
                    );
                    if (r?.error) toast(r.error, "error");
                    else {
                      toast(r?.ok ?? "Added.");
                      setResult(null);
                    }
                  });
                }}
              >
                <fieldset>
                  <legend className="sr-only">Trackers to hold</legend>
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {fresh.map((f) => (
                      <li key={f.pattern}>
                        <label className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-paper">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-brand"
                            checked={picked.has(f.pattern)}
                            onChange={(e) =>
                              setPicked((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(f.pattern);
                                else n.delete(f.pattern);
                                return n;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-sm font-bold">{f.name}</span>{" "}
                            <Badge tone="held" className="ml-1 align-middle">
                              {labelOf(f.category)}
                            </Badge>
                            <span className="mt-0.5 block truncate font-mono text-xs text-ink-3">{f.evidence}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <div className="mt-3 flex justify-end">
                  <Button type="submit" loading={adding} loadingLabel="Adding" disabled={picked.size === 0}>
                    Hold {picked.size} selected
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
