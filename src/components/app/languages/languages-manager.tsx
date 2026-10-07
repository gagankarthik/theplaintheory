"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addLanguage, markReviewed, removeLanguage, saveTranslation } from "@/app/app/sites/[propertyId]/languages/actions";
import { IconAlert, IconCheck, IconPlus } from "@/components/icons";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
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
      {translation.status === "draft" ? (
        <p className="mb-5 flex items-start gap-2 rounded-md bg-amber-wash px-3 py-2.5 text-sm text-amber">
          <IconAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            {DRAFT_DISCLAIMER}
            {note ? ` ${note}` : ""}
          </span>
        </p>
      ) : (
        <p className="mb-5 flex items-start gap-2 rounded-md bg-jade-wash px-3 py-2.5 text-sm text-jade">
          <IconCheck size={16} className="mt-0.5 shrink-0" />
          <span>
            Reviewed by {translation.reviewedBy} on {translation.reviewedAt ? new Date(translation.reviewedAt).toLocaleDateString("en-GB", { dateStyle: "long" }) : "an unknown date"}. Editing the wording sends it back to draft.
          </span>
        </p>
      )}

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
                  <div>
                    <label htmlFor={fid} className="text-xs font-medium text-ink-3">
                      {f.label} · {info.name}
                    </label>
                    {f.long ? (
                      <textarea id={fid} dir={info.dir} lang={info.code} rows={4} maxLength={f.max} className="field mt-1" value={t.copy[f.key]} onChange={(e) => setCopy(f.key, e.target.value)} />
                    ) : (
                      <input id={fid} dir={info.dir} lang={info.code} maxLength={f.max} className="field mt-1" value={t.copy[f.key]} onChange={(e) => setCopy(f.key, e.target.value)} />
                    )}
                  </div>
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
                    <label htmlFor={`trc-${id}-l`} className="sr-only">
                      {src.label} name in {info.name}
                    </label>
                    <input id={`trc-${id}-l`} dir={info.dir} lang={info.code} maxLength={40} className="field" value={cur.label} onChange={(e) => setCat(id, "label", e.target.value)} />
                    <label htmlFor={`trc-${id}-d`} className="sr-only">
                      {src.label} description in {info.name}
                    </label>
                    <textarea id={`trc-${id}-d`} dir={info.dir} lang={info.code} rows={2} maxLength={300} className="field" value={cur.description} onChange={(e) => setCat(id, "description", e.target.value)} />
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
            <label htmlFor={`rev-${info.code}`} className="label">
              Reviewed by
            </label>
            <div className="flex gap-2">
              <input
                id={`rev-${info.code}`}
                className="field"
                placeholder="Native speaker's full name"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                disabled={dirty || pending}
                aria-describedby={`rev-${info.code}-h`}
              />
              <Button
                variant="ghost"
                disabled={dirty || pending || reviewer.trim().length < 2}
                onClick={() => run(() => markReviewed(property.id, framework, info.code, reviewer), true)}
              >
                Mark reviewed
              </Button>
            </div>
            <p id={`rev-${info.code}-h`} className="mt-1.5 text-xs text-ink-3">
              {dirty ? "Save your edits first; a review covers the exact text saved." : "Recorded with your email and today's date in the Evidence Pack."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
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
  const [preview, setPreview] = useState<LanguageCode | "en">("en");
  const [view, setView] = useState<"banner" | "prefs">("banner");
  const [pending, start] = useTransition();
  const toast = useToast();
  const frame = useRef<HTMLIFrameElement>(null);
  const translations = property.config.regions[framework].translations ?? {};

  const statusOf = (code: LanguageCode): Status => (code === "en" ? "reviewed" : translations[code]?.status ?? "none");
  const rank: Record<Status, number> = { reviewed: 0, draft: 1, none: 2 };
  const rows = LANGUAGES.filter((l) => (group === "indian" ? l.eighthSchedule : !l.eighthSchedule)).sort(
    (a, b) => rank[statusOf(a.code)] - rank[statusOf(b.code)] || a.name.localeCompare(b.name),
  );
  const added = Object.values(translations).filter(Boolean);
  const reviewedCount = added.filter((t) => t?.status === "reviewed").length;

  const send = useCallback(() => {
    const cfg = toPublicConfig(property, dpo);
    frame.current?.contentWindow?.postMessage({ type: "plain:preview", config: cfg, framework, view, lang: preview === "en" ? undefined : preview }, "*");
  }, [property, dpo, framework, view, preview]);
  useEffect(() => {
    send();
  }, [send]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === "plain:ready") send();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [send]);

  const locked = (l: LanguageInfo) => l.eighthSchedule && !indianLanguages && !FREE_LANGUAGES.includes(l.code);
  const editingInfo = editing ? LANGUAGES.find((l) => l.code === editing) : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Notice"
            value={framework}
            onChange={(f) => {
              setFramework(f);
              setPreview("en");
            }}
            options={FRAMEWORKS.map((f) => ({ value: f, label: FRAMEWORK_META[f].name }))}
          />
          <p className="text-sm text-ink-3" aria-live="polite">
            {added.length} added, {reviewedCount} reviewed
          </p>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <Segmented
              size="sm"
              label="Language group"
              value={group}
              onChange={setGroup}
              options={[
                { value: "indian", label: "22 Indian languages" },
                { value: "other", label: "Other languages" },
              ]}
            />
            {!indianLanguages ? <p className="text-xs text-ink-3">{planName} plan: English and Hindi. Starter adds all 22.</p> : null}
          </div>
          <div className="relative overflow-x-auto" role="region" aria-label="Languages table" tabIndex={0}>
          <table className="w-full text-left text-sm sm:min-w-[420px]">
            <caption className="sr-only">Languages for the {FRAMEWORK_META[framework].name} notice</caption>
            <thead className="border-b border-line bg-paper text-xs text-ink-3">
              <tr>
                <th scope="col" className="py-2.5 pr-2 pl-4 font-medium sm:px-5">Language</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Draft</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Status</th>
                <th scope="col" className="py-2.5 pr-4 pl-2 text-right font-medium sm:px-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {group === "other" ? (
                <tr>
                  <th scope="row" className="py-3 pr-2 pl-4 font-normal sm:px-5">
                    <span className="block font-medium text-ink">English</span>
                    <span className="block text-xs text-ink-3">Default copy, edited in Banner</span>
                    <span className="mt-1.5 block sm:hidden">
                      <Badge tone="brand">Default</Badge>
                    </span>
                  </th>
                  <td className="hidden px-3 py-3 text-ink-3 sm:table-cell">Source</td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <Badge tone="brand">Default</Badge>
                  </td>
                  <td className="py-3 pr-4 pl-2 text-right sm:px-5">
                    <Button size="sm" variant="quiet" onClick={() => setPreview("en")} aria-pressed={preview === "en"}>
                      Preview
                    </Button>
                  </td>
                </tr>
              ) : null}
              {rows
                .filter((l) => l.code !== "en")
                .map((l) => {
                  const status = statusOf(l.code);
                  const hasDraft = Boolean(NOTICE_DRAFTS[l.code]) && (framework === "dpdpa" || framework === "generic");
                  return (
                    <tr key={l.code} className={preview === l.code ? "bg-brand-wash/40" : "hover:bg-paper"}>
                      <th scope="row" className="py-3 pr-2 pl-4 font-normal sm:px-5">
                        <span className="block font-medium text-ink">{l.name}</span>
                        <span className="block text-xs text-ink-3" lang={l.code} dir={l.dir}>
                          {l.native}
                        </span>
                        <span className="mt-1.5 block sm:hidden">
                          <StatusBadge status={status} />
                        </span>
                      </th>
                      <td className="hidden px-3 py-3 text-xs text-ink-3 sm:table-cell">{hasDraft ? "Machine-assisted" : "From English"}</td>
                      <td className="hidden px-3 py-3 sm:table-cell">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-3 pr-4 pl-2 sm:px-5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {status === "none" ? (
                            locked(l) ? (
                              upgrade && canWrite ? (
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
                              )
                            ) : canWrite ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() =>
                                  start(async () => {
                                    const r = await addLanguage(property.id, framework, l.code);
                                    if (r?.error) toast(r.error, "error");
                                    else if (r?.ok) {
                                      toast(r.ok);
                                      setPreview(l.code);
                                    }
                                  })
                                }
                              >
                                <IconPlus size={14} /> Add
                              </Button>
                            ) : null
                          ) : (
                            <>
                              <Button size="sm" variant="quiet" className="max-sm:hidden" onClick={() => setPreview(l.code)} aria-pressed={preview === l.code} aria-label={`Preview ${l.name}`}>
                                Preview
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(l.code)} aria-label={`${canWrite ? "Edit" : "View"} ${l.name}`}>
                                {canWrite ? "Edit" : "View"}
                              </Button>
                              {canWrite ? (
                                <Button
                                  size="sm"
                                  variant="quiet"
                                  disabled={pending}
                                  aria-label={`Remove ${l.name}`}
                                  onClick={() =>
                                    start(async () => {
                                      if (!window.confirm(`Remove ${l.name} from the ${FRAMEWORK_META[framework].name} notice?`)) return;
                                      const r = await removeLanguage(property.id, framework, l.code);
                                      if (r?.error) toast(r.error, "error");
                                      else if (r?.ok) {
                                        toast(r.ok);
                                        if (preview === l.code) setPreview("en");
                                      }
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Visitors see the language that matches the page&apos;s <code className="font-mono">lang</code> attribute or their browser, falling back to English. Changes go live when you publish.
        </p>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Preview: {preview === "en" ? "English" : LANGUAGES.find((l) => l.code === preview)?.name}
          </p>
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
        <div className="overflow-hidden rounded-xl border border-line bg-line p-3">
          <iframe ref={frame} src="/preview-frame" title="Notice preview in the selected language" className="block h-[540px] w-full rounded-lg border border-line-strong bg-white" onLoad={send} />
        </div>
      </div>

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
    </div>
  );
}
