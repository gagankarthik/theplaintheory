"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { publishSite, saveConfig } from "@/app/app/sites/[propertyId]/actions";
import type { ActionResult } from "@/lib/action-result";
import {
  CATEGORY_ICONS,
  IconAlert,
  IconBalance,
  IconDesktop,
  IconLayoutBar,
  IconLayoutModal,
  IconLayoutToast,
  IconMobileApp,
} from "@/components/icons";
import { contrastRatio, isHex } from "@/lib/color";
import { evaluateFairness, fixHref } from "@/lib/fairness";
import { FRAMEWORK_META } from "@/lib/defaults";
import { toPublicConfig } from "@/lib/public-config";
import type { BannerConfig, BannerCopy, Framework, Layout, Position, Property } from "@/lib/types";
import { FormMessage } from "@/components/app/ui/toast";
import { Segmented, TabPanel, Tabs } from "@/components/app/ui/tabs";
import { Button } from "@/components/app/ui/button";
import { Switch } from "@/components/app/ui/switch";
import { ChipInput } from "@/components/app/ui/chip-input";
import { CheckList, ScoreRing } from "@/components/app/compliance/check-list";

type Draft = Omit<BannerConfig, "version">;

const LAYOUTS: { id: Layout; label: string; icon: typeof IconLayoutBar; positions: Position[] }[] = [
  { id: "bar", label: "Bottom bar", icon: IconLayoutBar, positions: ["bottom", "top"] },
  { id: "modal", label: "Center modal", icon: IconLayoutModal, positions: ["center"] },
  { id: "toast", label: "Corner toast", icon: IconLayoutToast, positions: ["bottom-left", "bottom-right"] },
];
const POSITION_LABEL: Record<Position, string> = {
  bottom: "Bottom",
  top: "Top",
  center: "Center",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};
const FRAMEWORKS: Framework[] = ["gdpr", "ccpa", "dpdpa", "generic"];
const COPY_FIELDS: { key: keyof BannerCopy; label: string; long?: boolean }[] = [
  { key: "title", label: "Heading" },
  { key: "body", label: "Explanation", long: true },
  { key: "acceptAll", label: "Accept button" },
  { key: "rejectAll", label: "Reject button" },
  { key: "customize", label: "Customize link" },
  { key: "save", label: "Save choices button" },
  { key: "policyLabel", label: "Policy link text" },
];

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Follow external changes (e.g. the picker) without an effect.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex h-11 items-center gap-2 rounded-md border-[1.5px] border-line-strong bg-surface pl-1.5 pr-3 focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--color-brand-wash)]">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-line [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          className="w-full min-w-0 bg-transparent font-mono text-sm uppercase outline-none"
          spellCheck={false}
          maxLength={7}
        />
      </div>
    </div>
  );
}

function ContrastNote({ a, b, what }: { a: string; b: string; what: string }) {
  const r = contrastRatio(a, b);
  const ok = r >= 4.5;
  return (
    <p className={`flex items-center gap-1.5 text-xs ${ok ? "text-ink-3" : "font-bold text-rose"}`}>
      {ok ? null : <IconAlert size={14} />}
      {what}: <span className="tabular-nums">{r.toFixed(1)}:1</span>
      {ok ? (r >= 7 ? " passes AAA" : " passes AA") : " is below the 4.5:1 minimum. Visitors with low vision may not be able to read it."}
    </p>
  );
}

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line px-5 py-6 last:border-b-0 sm:px-6">
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

type BuilderTab = "design" | "text" | "categories" | "behaviour";
const TABS: BuilderTab[] = ["design", "text", "categories", "behaviour"];

export function BannerBuilder({
  property,
  dpo,
  canWrite,
  initialTab,
}: {
  property: Property;
  dpo?: { name: string; email: string };
  canWrite: boolean;
  /** deep link from a fix button, e.g. ?tab=categories */
  initialTab?: string;
}) {
  const initial = useMemo<Draft>(() => {
    const { version, ...rest } = property.config;
    void version;
    return rest;
  }, [property.config]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [tab, setTab] = useState<BuilderTab>(TABS.includes(initialTab as BuilderTab) ? (initialTab as BuilderTab) : "design");
  const controls = useRef<HTMLDivElement>(null);
  const [framework, setFramework] = useState<Framework>("gdpr");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const frame = useRef<HTMLIFrameElement>(null);

  const unsaved = JSON.stringify(draft) !== JSON.stringify(initial);
  const unpublished = property.config.version !== property.publishedVersion;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setTheme = <K extends keyof Draft["theme"]>(k: K, v: Draft["theme"][K]) => setDraft((d) => ({ ...d, theme: { ...d.theme, [k]: v } }));
  const setCopy = (fw: Framework, k: keyof BannerCopy, v: string) =>
    setDraft((d) => ({ ...d, regions: { ...d.regions, [fw]: { ...d.regions[fw], copy: { ...d.regions[fw].copy, [k]: v } } } }));

  const send = useCallback(() => {
    const cfg = toPublicConfig({ ...property, config: { ...draft, version: property.config.version } }, dpo);
    frame.current?.contentWindow?.postMessage({ type: "plain:preview", config: cfg, framework }, "*");
  }, [draft, framework, property, dpo]);

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

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!unsaved) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  const save = () => start(async () => setState(await saveConfig(property.id, draft)));
  const publish = () =>
    start(async () => {
      if (unsaved) {
        const r = await saveConfig(property.id, draft);
        if (r?.error) return setState(r);
      }
      setState(await publishSite(property.id));
    });

  const strictRegions = (["gdpr", "dpdpa"] as const).filter((f) => draft.regions[f].enabled);
  const fairness = useMemo(() => evaluateFairness(draft, { dpoEmail: dpo?.email }), [draft, dpo?.email]);
  const blocked = fairness.failures.length > 0;
  // Fixes inside the builder switch tabs in place; others link to their page.
  const goTo = (target: string) => {
    const t = target.split(":")[1] as BuilderTab | undefined;
    if (t && TABS.includes(t)) {
      setTab(t);
      controls.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const layout = LAYOUTS.find((l) => l.id === draft.theme.layout)!;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* controls */}
      <div ref={controls} className="panel scroll-mt-20 self-start overflow-hidden">
        <Tabs
          idBase="builder"
          label="Builder sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: "design", label: "Design" },
            { value: "text", label: "Text" },
            { value: "categories", label: "Categories" },
            { value: "behaviour", label: "Behaviour" },
          ]}
        />

        <TabPanel idBase="builder" value={tab}>
        <fieldset disabled={!canWrite} className="min-w-0">
          <legend className="sr-only">Banner settings</legend>
          {tab === "design" ? (
            <>
              <Section title="Layout">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Layout">
                  {LAYOUTS.map((l) => {
                    const active = l.id === draft.theme.layout;
                    // Native radios give arrow-key movement and form semantics for free.
                    return (
                      <label
                        key={l.id}
                        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-[1.5px] px-2 py-3 text-xs font-bold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                          active ? "border-brand bg-brand-wash text-brand-ink" : "border-line text-ink-2 hover:border-line-strong hover:bg-paper"
                        }`}
                      >
                        <input
                          type="radio"
                          name="layout"
                          value={l.id}
                          checked={active}
                          onChange={() => setDraft((d) => ({ ...d, theme: { ...d.theme, layout: l.id, position: l.positions[0] } }))}
                          className="sr-only"
                        />
                        <l.icon size={30} strokeWidth={1.5} />
                        {l.label}
                      </label>
                    );
                  })}
                </div>
                {layout.positions.length > 1 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-2">Position</span>
                    <Segmented
                      size="sm"
                      label="Position"
                      value={draft.theme.position}
                      onChange={(v) => setTheme("position", v)}
                      options={layout.positions.map((p) => ({ value: p, label: POSITION_LABEL[p] }))}
                    />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-2">Privacy choices button</span>
                  <Segmented
                    size="sm"
                    label="Privacy choices button corner"
                    value={draft.theme.fabSide ?? "left"}
                    onChange={(v) => setTheme("fabSide", v)}
                    options={[
                      { value: "left", label: "Bottom left" },
                      { value: "right", label: "Bottom right" },
                    ]}
                  />
                </div>
              </Section>
              <Section title="Colors">
                <div className="grid grid-cols-2 gap-3">
                  <ColorField id="c-bg" label="Background" value={draft.theme.background} onChange={(v) => setTheme("background", v)} />
                  <ColorField id="c-text" label="Text" value={draft.theme.text} onChange={(v) => setTheme("text", v)} />
                  <ColorField id="c-accent" label="Button" value={draft.theme.accent} onChange={(v) => setTheme("accent", v)} />
                  <ColorField id="c-accent-text" label="Button text" value={draft.theme.accentText} onChange={(v) => setTheme("accentText", v)} />
                </div>
                <div className="space-y-1">
                  <ContrastNote a={draft.theme.text} b={draft.theme.background} what="Text contrast" />
                  <ContrastNote a={draft.theme.accentText} b={draft.theme.accent} what="Button contrast" />
                </div>
              </Section>
              <Section title="Shape and type">
                <div>
                  <div className="mb-1.5 flex justify-between">
                    <label htmlFor="radius" className="label mb-0">
                      Corner radius
                    </label>
                    <span className="text-xs tabular-nums text-ink-3">{draft.theme.radius}px</span>
                  </div>
                  <input id="radius" type="range" min={0} max={28} value={draft.theme.radius} onChange={(e) => setTheme("radius", Number(e.target.value))} className="w-full accent-brand" />
                </div>
                <div>
                  <label htmlFor="font" className="label">
                    Font
                  </label>
                  <select id="font" className="field" value={draft.theme.font} onChange={(e) => setTheme("font", e.target.value as Draft["theme"]["font"])}>
                    <option value="system">System UI (fastest, no download)</option>
                    <option value="inherit">Inherit from my site</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Monospace</option>
                  </select>
                </div>
              </Section>
              <Section title="Fair choice">
                <Switch
                  label="Equal-weight buttons"
                  description="Reject looks exactly like Accept. Regulators treat a faded or hidden reject button as a dark pattern."
                  checked={draft.theme.equalButtons}
                  onChange={(v) => setTheme("equalButtons", v)}
                />
                {!draft.theme.equalButtons && strictRegions.length ? (
                  <p className="flex gap-2 rounded-md bg-rose-wash px-3 py-2.5 text-xs text-rose">
                    <IconBalance size={18} className="shrink-0" />
                    <span>
                      {strictRegions.map((f) => FRAMEWORK_META[f].name).join(" and ")} require refusing to be as easy as accepting. Turn this back on unless only CCPA
                      regions are enabled.
                    </span>
                  </p>
                ) : null}
              </Section>
            </>
          ) : null}

          {tab === "text" ? (
            <>
              <Section title="Wording per region" description="Write it the way you'd say it to a customer. Plain words get more informed choices.">
                <Segmented
                  size="sm"
                  label="Region"
                  value={framework}
                  onChange={setFramework}
                  options={FRAMEWORKS.map((f) => ({ value: f, label: FRAMEWORK_META[f].name }))}
                />
                {!draft.regions[framework].enabled ? (
                  <p className="text-xs text-amber">This region is turned off in Regions, so visitors won&apos;t see this text.</p>
                ) : null}
                {COPY_FIELDS.map((f) => {
                  const v = draft.regions[framework].copy[f.key];
                  const fid = `copy-${framework}-${f.key}`;
                  return (
                    <div key={f.key}>
                      <label htmlFor={fid} className="label">
                        {f.label}
                      </label>
                      {f.long ? (
                        <>
                          <textarea id={fid} rows={4} className="field" value={v} maxLength={600} onChange={(e) => setCopy(framework, f.key, e.target.value)} />
                          <p className="mt-1 text-right text-xs tabular-nums text-ink-3">{v.length} / 600</p>
                        </>
                      ) : (
                        <input id={fid} className="field" value={v} maxLength={f.key === "title" ? 80 : 60} onChange={(e) => setCopy(framework, f.key, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </Section>
              <Section title="Policy link">
                <div>
                  <label htmlFor="policy" className="label">
                    Privacy or cookie policy URL
                  </label>
                  <input id="policy" type="url" className="field" value={draft.policyUrl} onChange={(e) => set("policyUrl", e.target.value)} />
                </div>
              </Section>
            </>
          ) : null}

          {tab === "categories" ? (
            <Section
              title="Purposes"
              description="Visitors see these in Customise Consent Preferences. Say what each one does, the data it uses and how long it's kept."
            >
              {draft.categories.map((c, i) => {
                const Icon = CATEGORY_ICONS[c.id];
                return (
                  <div key={c.id} className={`rounded-lg p-4 ${c.required ? "released" : "held"} !text-ink`}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icon size={18} className={c.required ? "text-jade" : "text-amber"} />
                      <span className="text-xs font-bold text-ink-2">{c.required ? "Always on" : "Held until consent"}</span>
                    </div>
                    <label htmlFor={`cat-${c.id}`} className="label">
                      Name
                    </label>
                    <input
                      id={`cat-${c.id}`}
                      className="field mb-3"
                      value={c.label}
                      maxLength={40}
                      onChange={(e) => set("categories", draft.categories.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                    <label htmlFor={`cat-${c.id}-d`} className="label">
                      What it does
                    </label>
                    <textarea
                      id={`cat-${c.id}-d`}
                      rows={2}
                      className="field mb-3"
                      value={c.description}
                      maxLength={300}
                      onChange={(e) => set("categories", draft.categories.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                    />
                    <ChipInput
                      id={`cat-${c.id}-items`}
                      label="Personal data collected"
                      hint={c.required ? "Shown so visitors know what even essential cookies hold." : "DPDPA requires an itemised list for each purpose. Press Enter after each item."}
                      values={c.dataItems ?? []}
                      disabled={!canWrite}
                      onChange={(v) => set("categories", draft.categories.map((x, j) => (j === i ? { ...x, dataItems: v } : x)))}
                    />
                    <label htmlFor={`cat-${c.id}-ret`} className="label mt-3">
                      Kept for
                    </label>
                    <input
                      id={`cat-${c.id}-ret`}
                      className="field"
                      value={c.retention ?? ""}
                      maxLength={80}
                      placeholder="e.g. 13 months"
                      onChange={(e) => set("categories", draft.categories.map((x, j) => (j === i ? { ...x, retention: e.target.value } : x)))}
                    />
                  </div>
                );
              })}
            </Section>
          ) : null}

          {tab === "behaviour" ? (
            <>
              <Section title="Rendering">
                <Switch
                  label="Headless mode"
                  description="Load rules and blocking but draw no banner. Build your own UI with window.PlainConsent."
                  checked={draft.headless}
                  onChange={(v) => set("headless", v)}
                />
                <Switch
                  label="Google Consent Mode v2"
                  description="Send ad_storage, analytics_storage, ad_user_data and ad_personalization signals to Google tags."
                  checked={draft.googleConsentMode}
                  onChange={(v) => set("googleConsentMode", v)}
                />
              </Section>
              <Section title="Re-asking">
                <div>
                  <label htmlFor="expiry" className="label">
                    Ask again after (days)
                  </label>
                  <input
                    id="expiry"
                    type="number"
                    min={1}
                    max={395}
                    className="field w-32 tabular-nums"
                    value={draft.expiryDays}
                    onChange={(e) => set("expiryDays", Math.max(1, Math.min(395, Number(e.target.value) || 1)))}
                  />
                  <p className="mt-1.5 text-xs text-ink-3">Many EU regulators expect 6 to 13 months. We also ask again whenever categories change.</p>
                </div>
              </Section>
            </>
          ) : null}
        </fieldset>
        </TabPanel>

        {canWrite ? (
          <div className="sticky bottom-0 space-y-3 border-t border-line bg-surface px-5 py-4 sm:px-6">
            <FormMessage state={state} />
            {blocked ? (
              <p id="publish-blocked" className="flex items-start gap-2 text-xs text-rose">
                <IconAlert size={14} className="mt-0.5 shrink-0" />
                Fix {fairness.failures.length === 1 ? "1 failing check" : `${fairness.failures.length} failing checks`} in the fairness check before publishing.
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink-3">{unsaved ? "Unsaved edits" : unpublished ? "Saved, not yet published" : "Saved and live"}</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={save} disabled={pending || !unsaved}>
                  Save draft
                </Button>
                <Button
                  onClick={publish}
                  loading={pending}
                  disabled={(!unsaved && !unpublished) || blocked}
                  aria-describedby={blocked ? "publish-blocked" : undefined}
                >
                  Publish
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="border-t border-line px-6 py-4 text-sm text-ink-3">You have view access. Ask an admin to change the banner.</p>
        )}
      </div>

      {/* preview */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="sm"
            label="Preview region"
            value={framework}
            onChange={setFramework}
            options={FRAMEWORKS.map((f) => ({ value: f, label: FRAMEWORK_META[f].name, title: FRAMEWORK_META[f].region }))}
          />
          <Segmented
            size="sm"
            label="Preview device"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: <IconDesktop size={16} title="Desktop" /> },
              { value: "mobile", label: <IconMobileApp size={16} title="Mobile" /> },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-line p-3 sm:p-5">
          <div
            className="mx-auto overflow-hidden rounded-lg border border-line-strong bg-white shadow-lift transition-[max-width] duration-300"
            style={{ maxWidth: device === "mobile" ? 390 : "100%" }}
          >
            <div className="flex h-8 items-center gap-1.5 border-b border-line bg-paper px-3" aria-hidden>
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="ml-3 truncate rounded bg-surface px-2 py-0.5 text-[11px] text-ink-3">{property.domain}</span>
            </div>
            <iframe
              ref={frame}
              src="/preview-frame"
              title={`Banner preview for ${FRAMEWORK_META[framework].region}`}
              className="block h-[560px] w-full bg-white"
              onLoad={send}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Showing the {FRAMEWORK_META[framework].name} notice ({FRAMEWORK_META[framework].region}). The preview uses your unsaved edits; visitors see the last published version.
        </p>

        <section aria-labelledby="fairness-h" className="panel mt-6 overflow-hidden">
          <div className="flex items-center gap-4 border-b border-line px-5 py-4">
            <ScoreRing value={fairness.score} label="Fairness score" size={52} />
            <div className="min-w-0">
              <h2 id="fairness-h" className="text-base font-semibold">
                Fairness check
              </h2>
              <p className="text-sm text-ink-3" aria-live="polite">
                {fairness.failures.length
                  ? `${fairness.failures.length} failing, ${fairness.warnings.length} to review. Failing checks block publishing.`
                  : fairness.warnings.length
                    ? `Ready to publish. ${fairness.warnings.length} suggestion${fairness.warnings.length > 1 ? "s" : ""} to review.`
                    : "Every check passes for the regions you have turned on."}
              </p>
            </div>
          </div>
          <div className="px-5">
            <CheckList
              dense
              rows={fairness.checks.map((c) => {
                const href = c.fix && !c.fix.target.startsWith("banner:") ? fixHref(property.id, c.fix.target) : undefined;
                return {
                  id: c.id,
                  severity: c.severity,
                  title: c.title,
                  detail: c.detail,
                  tag: c.framework === "all" ? undefined : FRAMEWORK_META[c.framework].name,
                  ref: c.ref,
                  fix: c.fix ? { label: c.fix.label, href, onClick: href ? undefined : () => goTo(c.fix!.target) } : undefined,
                };
              })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
