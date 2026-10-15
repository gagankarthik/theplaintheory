"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addLanguage, markReviewed, removeLanguage, saveTranslation } from "@/app/app/sites/[propertyId]/languages/actions";
import { IconPlus, IconTrash } from "@/components/icons";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { Dialog } from "@/components/app/ui/dialog";
import { TextAreaField, TextField } from "@/components/app/ui/field";
import { Segmented } from "@/components/app/ui/tabs";
import { useToast } from "@/components/app/ui/toast";
import { FRAMEWORK_META } from "@/lib/defaults";
import { FREE_LANGUAGES, LANGUAGES, type LanguageInfo } from "@/lib/i18n/languages";
import { DRAFT_DISCLAIMER, NOTICE_DRAFTS } from "@/lib/i18n/notice-drafts";
import { toPublicConfig } from "@/lib/public-config";
import type { BannerCopy, CategoryId, Framework, LanguageCode, NoticeTranslation, Property } from "@/lib/types";
import { LockedAction, type UpgradeOffer } from "@/components/app/billing/upgrade-dialog";

const FRAMEWORKS: Framework[] = ["dpdpa", "gdpr", "ccpa", "generic"];
const COPY_FIELDS: { key: keyof BannerCopy; label: string; long?: boolean; max: number }[] = [
  { key: "title", label: "Heading", max: 80 },
  { key: "body", label: "Explanation", long: true, max: 600 },
  { key: "acceptAll", label: "Accept button", max: 60 },
  { key: "rejectAll", label: "Reject button", max: 60 },
  { key: "customize", label: "Customise link", max: 60 },
  { key: "save", label: "Save button", max: 60 },
  { key: "policyLabel", label: "Policy link text", max: 60 },
];
const CATS: CategoryId[] = ["essential", "functional", "analytics", "marketing"];

type Status = "none" | "draft" | "reviewed";

function StatusBadge({ status }: { status: Status }) {
  if (status === "reviewed") return <Badge tone="released">Reviewed</Badge>;
  if (status === "draft") return <Badge tone="held">Draft</Badge>;
  return <Badge tone="neutral">Not added</Badge>;
}

function Editor({
  open,
  onClose,
  info,
  framework,
  property,
  translation,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  info: LanguageInfo;
  framework: Framework;
  property: Property;
  translation: NoticeTranslation;
  canWrite: boolean;
}) {
  const [t, setT] = useState(translation);
  const [reviewer, setReviewer] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const source = property.config.regions[framework].copy;
  const dirty = JSON.stringify(t) !== JSON.stringify(translation);
  const note = NOTICE_DRAFTS[info.code]?.note;

  const setCopy = (k: keyof BannerCopy, v: string) => setT((x) => ({ ...x, copy: { ...x.copy, [k]: v } }));
  const setCat = (id: CategoryId, k: "label" | "description", v: string) =>
    setT((x) => {
      const cur = x.categories?.[id] ?? { label: "", description: "" };
      return { ...x, categories: { ...x.categories, [id]: { ...cur, [k]: v } } };
    });

  const run = (fn: () => Promise<{ ok?: string; error?: string } | null>, close = false) =>
    start(async () => {
      const r = await fn();
      if (r?.error) toast(r.error, "error");
      else {
        if (r?.ok) toast(r.ok);
        if (close) onClose();
      }
    });

  return (
    <Dialog open={open} onClose={onClose} title={`${info.name} · ${FRAMEWORK_META[framework].name} notice`} description={`${info.native}. English on the left, ${info.name} on the right.`} width={940}>
      <div className="mb-5">
        {translation.status === "draft" ? (
          <Alert tone="warning" title="Draft translation">
            {DRAFT_DISCLAIMER}
            {note ? ` ${note}` : ""}
          </Alert>
        ) : (
          <Alert tone="success" title={`Reviewed by ${translation.reviewedBy}`}>
            On {translation.reviewedAt ? new Date(translation.reviewedAt).toLocaleDateString("en-GB", { dateStyle: "long" }) : "an unknown date"}. Editing the wording sends it back to draft.
          </Alert>
        )}
      </div>

      <fieldset disabled={!canWrite || pending} className="min-w-0 space-y-6">
        <legend className="sr-only">Translation</legend>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Notice</h3>
          <div className="divide-y divide-line rounded-lg border border-line">
            {COPY_FIELDS.map((f) => {
              const fid = `tr-${info.code}-${f.key}`;
              return (
                <div key={f.key} className="grid gap-3 p-4 md:grid-cols-2 md:gap-6">
                  <div>
                    <p className="text-xs font-medium text-ink-3">{f.label} · English</p>
                    <p className="mt-1 text-sm text-ink-2">{source[f.key]}</p>
                  </div>
                  {f.long ? (
                    <TextAreaField id={fid} label={`${f.label} · ${info.name}`} dir={info.dir} lang={info.code} maxLength={f.max} rows={4} value={t.copy[f.key]} onChange={(e) => setCopy(f.key, e.target.value)} />
                  ) : (
                    <TextField id={fid} label={`${f.label} · ${info.name}`} dir={info.dir} lang={info.code} maxLength={f.max} value={t.copy[f.key]} onChange={(e) => setCopy(f.key, e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Purposes</h3>
          <div className="divide-y divide-line rounded-lg border border-line">
            {CATS.map((id) => {
              const src = property.config.categories.find((c) => c.id === id)!;
              const cur = t.categories?.[id] ?? { label: "", description: "" };
              return (
                <div key={id} className="grid gap-3 p-4 md:grid-cols-2 md:gap-6">
                  <div>
                    <p className="text-sm font-medium text-ink">{src.label}</p>
                    <p className="mt-1 text-sm text-ink-2">{src.description}</p>
                  </div>
                  <div className="space-y-2">
                    <TextField id={`trc-${id}-l`} label={`${src.label} name in ${info.name}`} hideLabel dir={info.dir} lang={info.code} maxLength={40} value={cur.label} onChange={(e) => setCat(id, "label", e.target.value)} />
                    <TextAreaField
                      id={`trc-${id}-d`}
                      label={`${src.label} description in ${info.name}`}
                      hideLabel
                      dir={info.dir}
                      lang={info.code}
                      rows={2}
                      maxLength={300}
                      value={cur.description}
                      onChange={(e) => setCat(id, "description", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>

      {canWrite ? (
        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-sm">
            <div className="flex items-end gap-2">
              <TextField
                id={`rev-${info.code}`}
                label="Reviewed by"
                className="min-w-0 flex-1"
                placeholder="Native speaker's full name"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                disabled={dirty || pending}
                aria-describedby={`rev-${info.code}-note`}
              />
              <Button variant="secondary" className="shrink-0" disabled={dirty || pending || reviewer.trim().length < 2} onClick={() => run(() => markReviewed(property.id, framework, info.code, reviewer), true)}>
                Mark reviewed
              </Button>
            </div>
            <p id={`rev-${info.code}-note`} className="mt-1.5 text-xs text-ink-3">
              {dirty ? "Save your edits first; a review covers the exact text saved." : "Recorded with your email and today's date in the Evidence Pack."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
            <Button loading={pending} loadingLabel="Saving" disabled={!dirty} onClick={() => run(() => saveTranslation(property.id, framework, info.code, t))}>
              Save translation
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

interface LanguageRow {
  info: LanguageInfo;
  status: Status;
  english?: boolean;
}

/** The preview frame's origin: preview messages go only there and are only accepted from there. */
function frameOrigin(f: HTMLIFrameElement | null) {
  try {
    return new URL(f?.src || "/preview-frame", window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

export function LanguagesManager({
  property,
  dpo,
  canWrite,
  indianLanguages,
  planName,
  upgrade,
}: {
  property: Property;
  dpo?: { name: string; email: string };
  canWrite: boolean;
  /** plan allows Eighth Schedule languages beyond Hindi */
  indianLanguages: boolean;
  planName: string;
  /** plans that add the Indian languages, for the locked rows' upgrade dialog */
  upgrade?: UpgradeOffer;
}) {
  const [framework, setFramework] = useState<Framework>("dpdpa");
  const [group, setGroup] = useState<"indian" | "other">("indian");
  const [editing, setEditing] = useState<LanguageCode | null>(null);
  const [removing, setRemoving] = useState<LanguageInfo | null>(null);
  const [preview, setPreview] = useState<LanguageCode | "en">("en");
  const [view, setView] = useState<"banner" | "prefs">("banner");
  const [pending, start] = useTransition();
  const toast = useToast();
  const frame = useRef<HTMLIFrameElement>(null);
  const translations = property.config.regions[framework].translations ?? {};

  const statusOf = (code: LanguageCode): Status => (code === "en" ? "reviewed" : (translations[code]?.status ?? "none"));
  const rank: Record<Status, number> = { reviewed: 0, draft: 1, none: 2 };
  const english = LANGUAGES.find((l) => l.code === "en");
  const rows: LanguageRow[] = [
    ...(group === "other" && english ? [{ info: english, status: "reviewed" as Status, english: true }] : []),
    ...LANGUAGES.filter((l) => l.code !== "en" && (group === "indian" ? l.eighthSchedule : !l.eighthSchedule))
      .map((info) => ({ info, status: statusOf(info.code) }))
      .sort((a, b) => rank[a.status] - rank[b.status] || a.info.name.localeCompare(b.info.name)),
  ];
  const added = Object.values(translations).filter(Boolean);
  const reviewedCount = added.filter((t) => t?.status === "reviewed").length;

  const send = useCallback(() => {
    const cfg = toPublicConfig(property, dpo);
    frame.current?.contentWindow?.postMessage({ type: "plain:preview", config: cfg, framework, view, lang: preview === "en" ? undefined : preview }, frameOrigin(frame.current));
  }, [property, dpo, framework, view, preview]);
  useEffect(() => {
    send();
  }, [send]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.origin === frameOrigin(frame.current) && e.data?.type === "plain:ready") send();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [send]);

  const locked = (l: LanguageInfo) => l.eighthSchedule && !indianLanguages && !FREE_LANGUAGES.includes(l.code);
  const editingInfo = editing ? LANGUAGES.find((l) => l.code === editing) : undefined;
  const previewName = preview === "en" ? "English" : LANGUAGES.find((l) => l.code === preview)?.name;

  const add = (l: LanguageInfo) =>
    start(async () => {
      const r = await addLanguage(property.id, framework, l.code);
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) {
        toast(r.ok);
        setPreview(l.code);
      }
    });

  const actions = ({ info: l, status, english: isEnglish }: LanguageRow) => {
    if (isEnglish)
      return (
        <Button size="sm" variant="quiet" onClick={() => setPreview("en")} aria-pressed={preview === "en"} aria-label="Preview English">
          Preview
        </Button>
      );
    if (status === "none") {
      if (locked(l))
        return upgrade && canWrite ? (
          <LockedAction
            size="sm"
            variant="ghost"
            label="Add"
            title={`Add ${l.name} and the other Indian languages`}
            reason={`The ${planName} plan includes English and Hindi. DPDPA lets visitors read the notice in any of the 22 Eighth Schedule languages.`}
            unlocks={() => "All 22 Eighth Schedule languages"}
            offer={upgrade}
          />
        ) : (
          <span className="text-xs text-ink-3">Paid plans</span>
        );
      return canWrite ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => add(l)} aria-label={`Add ${l.name}`}>
          <IconPlus size={14} aria-hidden /> Add
        </Button>
      ) : null;
    }
    return (
      <>
        <Button size="sm" variant="quiet" onClick={() => setPreview(l.code)} aria-pressed={preview === l.code} aria-label={`Preview ${l.name}`}>
          Preview
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing(l.code)} aria-label={`${canWrite ? "Edit" : "View"} ${l.name}`}>
          {canWrite ? "Edit" : "View"}
        </Button>
        {canWrite ? (
          <Button size="sm" variant="danger-quiet" disabled={pending} aria-label={`Remove ${l.name}`} title="Remove" onClick={() => setRemoving(l)}>
            <IconTrash size={15} aria-hidden />
          </Button>
        ) : null}
      </>
    );
  };

  const columns: Column<LanguageRow>[] = [
    {
      id: "language",
      header: "Language",
      cell: ({ info, english: isEnglish }) => (
        <span className="block min-w-0">
          <span className="block font-medium text-ink">{info.name}</span>
          <span className="block text-xs text-ink-3" lang={isEnglish ? undefined : info.code} dir={info.dir}>
            {isEnglish ? "Default copy, edited in Banner studio" : info.native}
          </span>
        </span>
      ),
    },
    {
      id: "source",
      header: "Starts from",
      hideOnMobile: true,
      cell: ({ info, english: isEnglish }) => (
        <span className="text-ink-3">{isEnglish ? "Source" : NOTICE_DRAFTS[info.code] && (framework === "dpdpa" || framework === "generic") ? "Machine-assisted draft" : "English copy"}</span>
      ),
    },
    { id: "status", header: "Status", cell: (r) => (r.english ? <Badge tone="brand">Default</Badge> : <StatusBadge status={r.status} />) },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      mobileLabel: "Actions",
      align: "right",
      cell: (r) => <div className="flex flex-wrap justify-end gap-1.5">{actions(r)}</div>,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Notice"
            value={framework}
            onChange={(f) => {
              setFramework(f);
              setPreview("en");
            }}
            options={FRAMEWORKS.map((f) => ({ value: f, label: FRAMEWORK_META[f].name, title: FRAMEWORK_META[f].region }))}
          />
          <p className="text-sm tabular-nums text-ink-3" aria-live="polite">
            {added.length} added, {reviewedCount} reviewed
          </p>
        </div>

        <section aria-labelledby="lang-list-h" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="lang-list-h" className="text-base font-semibold">
                {FRAMEWORK_META[framework].name} notice languages
              </h2>
              {!indianLanguages ? <p className="mt-0.5 text-sm text-ink-3">{planName} plan: English and Hindi. Starter adds all 22 Indian languages.</p> : null}
            </div>
            <Segmented
              size="sm"
              label="Language group"
              value={group}
              onChange={setGroup}
              options={[
                { value: "indian", label: "Indian (22)" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
          <DataTable<LanguageRow>
            rows={rows}
            columns={columns}
            caption={`Languages for the ${FRAMEWORK_META[framework].name} notice`}
            rowKey={(r) => r.info.code}
            isSelected={(r) => r.info.code === preview && r.status !== "none"}
            minWidth={560}
          />
        </section>
      </div>

      <section aria-labelledby="lang-preview-h" className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="lang-preview-h" className="text-sm font-semibold">
            Preview <span className="font-normal text-ink-3">· {previewName}</span>
          </h2>
          <Segmented
            size="sm"
            label="Preview view"
            value={view}
            onChange={setView}
            options={[
              { value: "banner", label: "Banner" },
              { value: "prefs", label: "Preferences" },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-raised p-2 sm:p-3">
          <iframe ref={frame} src="/preview-frame" title={`Notice preview in ${previewName}`} className="block h-[480px] w-full rounded-md border border-line bg-surface sm:h-[540px]" onLoad={send} />
        </div>
        <p className="mt-2 text-xs text-ink-3">Shows saved wording. Visitors see it after you publish.</p>
      </section>

      {editingInfo && translations[editingInfo.code] ? (
        <Editor
          key={`${framework}-${editingInfo.code}-${property.config.version}`}
          open
          onClose={() => setEditing(null)}
          info={editingInfo}
          framework={framework}
          property={property}
          translation={translations[editingInfo.code]!}
          canWrite={canWrite}
        />
      ) : null}

      {canWrite ? (
        <ConfirmDialog
          open={removing !== null}
          onClose={() => setRemoving(null)}
          title={`Remove ${removing?.name ?? "this language"}?`}
          description={`The ${FRAMEWORK_META[framework].name} notice stops offering ${removing?.name ?? "this language"} after you publish, and its translation and review record are removed.`}
          confirmLabel="Remove language"
          pendingLabel="Removing"
          destructive
          onConfirm={async () => {
            if (!removing) return;
            const r = await removeLanguage(property.id, framework, removing.code);
            if (r?.error) return { error: r.error };
            if (r?.ok) toast(r.ok);
            if (preview === removing.code) setPreview("en");
          }}
        />
      ) : null}
    </div>
  );
}
