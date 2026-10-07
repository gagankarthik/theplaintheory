"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { publishSite, saveConfig } from "@/app/app/sites/[propertyId]/actions";
import type { ActionResult } from "@/lib/action-result";
import {
  CATEGORY_ICONS,
  IconAlert,
  IconBalance,
  IconCheck,
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
import { Segmented } from "@/components/app/ui/tabs";
import { Button } from "@/components/app/ui/button";
import { Switch } from "@/components/app/ui/switch";
import { ChipInput } from "@/components/app/ui/chip-input";
import { CheckList, ScoreRing } from "@/components/app/compliance/check-list";
import { Select } from "@/components/app/ui/select";

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
    <p className={`flex items-center gap-1.5 text-xs ${ok ? "text-ink-3" : "font-semibold text-rose"}`}>
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
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

type BuilderTab = "design" | "text" | "categories" | "behaviour" | "review";
const STEPS: { id: BuilderTab; label: string; hint: string }[] = [
  { id: "design", label: "Design", hint: "Layout, colours and type. Keep Reject as easy as Accept." },
  { id: "text", label: "Wording", hint: "What visitors read in each region, in plain words." },
  { id: "categories", label: "Purposes", hint: "What each category does, the data it uses and how long it's kept." },
  { id: "behaviour", label: "Behaviour", hint: "Signals to your tags and when to ask again." },
  { id: "review", label: "Review", hint: "Check fairness and linked details, then publish." },
];
const TABS = STEPS.map((x) => x.id);

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
  const idx = TABS.indexOf(tab);
  const go = (i: number) => {
    setTab(TABS[Math.max(0, Math.min(TABS.length - 1, i))]);
    controls.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // which steps have something to fix, from the same fairness rules the server enforces
  const issuesFor = (id: BuilderTab) => {
    const own = id === "review" ? fairness.checks.filter((c) => !c.fix || !c.fix.target.startsWith("banner:")) : fairness.checks.filter((c) => c.fix?.target === `banner:${id}`);
    return { fail: own.filter((c) => c.severity === "fail").length, warn: own.filter((c) => c.severity === "warn").length };
  };
  const nothingNew = !unsaved && !unpublished;
  const status = unsaved
    ? "Unsaved edits"
    : property.publishedVersion === 0
      ? property.config.version > 1
        ? `Draft v${property.config.version} saved · not published yet`
        : "Not published yet"
      : unpublished
        ? `Draft v${property.config.version} saved · v${property.publishedVersion} is live`
        : `v${property.publishedVersion} is live`;
  const fairnessSummary = fairness.failures.length
    ? `${fairness.failures.length} failing, ${fairness.warnings.length} to review. Failing checks block publishing.`
    : fairness.warnings.length
      ? `Ready to publish. ${fairness.warnings.length} suggestion${fairness.warnings.length > 1 ? "s" : ""} to review.`
      : "Every check passes for the regions you have turned on.";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* controls */}
      <div ref={controls} className="panel scroll-mt-20 self-start overflow-hidden">
        <nav aria-label="Banner setup steps" className="border-b border-line px-2 py-2.5 sm:px-3">
          <ol className="scroll-thin flex gap-1 overflow-x-auto">
            {STEPS.map((x, i) => {
              const current = x.id === tab;
              const issues = issuesFor(x.id);
              return (
                <li key={x.id} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setTab(x.id)}
                    aria-current={current ? "step" : undefined}
                    className={`flex w-full min-w-[4.25rem] flex-col items-center gap-1 rounded-[10px] px-1 py-2 transition-colors ${current ? "bg-brand-wash/70" : "hover:bg-paper"}`}
                  >
                    <span
                      aria-hidden
                      className={`relative grid size-7 place-items-center rounded-full text-xs font-semibold ${current ? "bg-brand text-white" : "bg-paper text-ink-2 ring-1 ring-inset ring-line"}`}
                    >
                      {i + 1}
                      {issues.fail ? (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-rose ring-2 ring-surface" />
                      ) : issues.warn ? (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-bright ring-2 ring-surface" />
                      ) : null}
                    </span>
                    <span className={`text-xs ${current ? "font-semibold text-brand-ink" : "text-ink-2"}`}>{x.label}</span>
                    <span className="sr-only">{issues.fail ? `, ${issues.fail} failing` : issues.warn ? `, ${issues.warn} to review` : ""}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="px-5 pt-5 sm:px-6">
          <p className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
            Step {idx + 1} of {STEPS.length}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">{STEPS[idx].label}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{STEPS[idx].hint}</p>
        </div>

        <div>
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
                        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-[1.5px] px-2 py-3 text-xs font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
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
                  <Select<Draft["theme"]["font"]>
                    id="font"
                    value={draft.theme.font}
                    onValueChange={(v) => setTheme("font", v)}
                    options={[
                      { value: "system", label: "System UI", description: "Fastest: nothing to download" },
                      { value: "inherit", label: "Inherit from my site", description: "Uses your site's body font" },
                      { value: "serif", label: "Serif" },
                      { value: "mono", label: "Monospace" },
                    ]}
                  />
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
                      <span className="text-xs font-semibold text-ink-2">{c.required ? "Always on" : "Held until consent"}</span>
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
          {tab === "review" ? (
            <>
              <Section title="Fairness check" description="The same rules run on our servers when you publish.">
                <div className="flex items-center gap-4">
                  <ScoreRing value={fairness.score} label="Fairness score" size={52} />
                  <p className="text-sm text-ink-2" aria-live="polite">
                    {fairnessSummary}
                  </p>
                </div>
                {(() => {
                  const toRow = (c: (typeof fairness.checks)[number]) => {
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
                  };
                  const open = fairness.checks.filter((c) => c.severity !== "pass");
                  const passing = fairness.checks.filter((c) => c.severity === "pass");
                  return (
                    <>
                      {open.length ? <CheckList dense rows={open.map(toRow)} /> : null}
                      {passing.length ? (
                        <details className="group rounded-[10px] border border-line">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm text-ink-2 hover:text-ink">
                            <span className="inline-flex items-center gap-2">
                              <IconCheck size={14} className="text-jade" />
                              {passing.length} check{passing.length === 1 ? "" : "s"} passing
                            </span>
                            <span aria-hidden className="text-xs text-ink-3 group-open:hidden">Show</span>
                            <span aria-hidden className="hidden text-xs text-ink-3 group-open:inline">Hide</span>
                          </summary>
                          <div className="border-t border-line px-3">
                            <CheckList dense rows={passing.map(toRow)} />
                          </div>
                        </details>
                      ) : null}
                    </>
                  );
                })()}
              </Section>
              <Section title="Details your notice links to" description="Kept on other pages because they're shared or need more room. Your notice shows them as they are now.">
                <ul className="divide-y divide-line rounded-[12px] border border-line">
                  {[
                    {
                      label: "Data Protection Officer",
                      value: dpo ? `${dpo.name} · ${dpo.email}` : null,
                      missing: "Not set. Notices must name someone to contact.",
                      href: "/app/settings#dpo",
                      required: true,
                    },
                    {
                      label: "Rights page and grievance email",
                      value: [draft.rights?.rightsUrl, draft.rights?.grievanceEmail].filter(Boolean).join(" · ") || null,
                      missing: "Not set. DPDPA notices say how to exercise rights and raise a grievance.",
                      href: `/app/sites/${property.id}/regions#notice`,
                      required: false,
                    },
                    {
                      label: "Data Protection Board link",
                      value: draft.rights?.boardComplaintUrl ?? null,
                      missing: "Not set yet. Add it once the Board publishes its complaint page.",
                      href: `/app/sites/${property.id}/regions#notice`,
                      required: false,
                    },
                    {
                      label: "Notice languages",
                      value: (() => {
                        const n = Object.keys(draft.regions.dpdpa.translations ?? {}).length;
                        return n ? `English + ${n} more` : null;
                      })(),
                      missing: "English only. Visitors in India may read the notice in any Eighth Schedule language.",
                      href: `/app/sites/${property.id}/languages`,
                      required: false,
                    },
                  ].map((row) => (
                    <li key={row.label} className="flex items-start gap-3 px-4 py-3">
                      <span
                        aria-hidden
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${row.value ? "bg-brand text-white" : row.required ? "bg-rose-wash text-rose" : "bg-amber-wash text-amber"}`}
                      >
                        {row.value ? <IconCheck size={12} /> : <IconAlert size={12} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{row.label}</span>
                        <span className={`block break-words text-xs ${row.value ? "text-ink-2" : row.required ? "text-rose" : "text-ink-3"}`}>{row.value ?? row.missing}</span>
                      </span>
                      <a href={row.href} className="shrink-0 text-xs font-medium text-brand underline-offset-2 hover:underline">
                        {row.value ? "Edit" : "Add"}
                        <span className="sr-only"> {row.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Versions">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[10px] bg-paper px-3 py-2.5">
                    <dt className="text-xs text-ink-3">Live for visitors</dt>
                    <dd className="mt-0.5 font-medium text-ink">
                      {property.publishedVersion ? `v${property.publishedVersion}` : "Nothing yet"}
                      {property.publishedAt ? <span className="block text-xs font-normal text-ink-3">{new Date(property.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span> : null}
                    </dd>
                  </div>
                  <div className="rounded-[10px] bg-paper px-3 py-2.5">
                    <dt className="text-xs text-ink-3">Your draft</dt>
                    <dd className="mt-0.5 font-medium text-ink">
                      v{property.config.version}
                      <span className="block text-xs font-normal text-ink-3">{unsaved ? "With unsaved edits" : nothingNew ? "Same as live" : "Saved, ready to publish"}</span>
                    </dd>
                  </div>
                </dl>
              </Section>
            </>
          ) : null}
        </fieldset>
        </div>

        {canWrite ? (
          <div className="sticky bottom-0 space-y-3 border-t border-line bg-surface px-5 py-4 sm:px-6">
            <FormMessage state={state} />
            {tab === "review" && (blocked || nothingNew) ? (
              <p id="publish-why" className={`flex items-start gap-2 text-xs ${blocked ? "text-rose" : "text-ink-3"}`}>
                {blocked ? <IconAlert size={14} className="mt-0.5 shrink-0" /> : null}
                {blocked
                  ? `Fix ${fairness.failures.length === 1 ? "the failing check" : `the ${fairness.failures.length} failing checks`} above before publishing.`
                  : "Nothing new to publish: visitors already see this version."}
              </p>
            ) : null}
            <p className="text-xs text-ink-3" aria-live="polite">
              {status}
            </p>
            <div className="flex items-center justify-between gap-2">
              {idx > 0 ? (
                <Button variant="quiet" onClick={() => go(idx - 1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={save} disabled={pending || !unsaved}>
                  Save draft
                </Button>
                {tab !== "review" ? (
                  <Button onClick={() => go(idx + 1)}>
                    Next: {STEPS[idx + 1].label}
                  </Button>
                ) : (
                  <Button onClick={publish} loading={pending} disabled={nothingNew || blocked} aria-describedby={blocked || nothingNew ? "publish-why" : undefined}>
                    Publish
                  </Button>
                )}
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
              <span className="ml-3 truncate rounded bg-surface px-2 py-0.5 text-2xs text-ink-3">{property.domain}</span>
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

        <button
          type="button"
          onClick={() => go(TABS.indexOf("review"))}
          className="mt-4 flex w-full items-center gap-3 rounded-[12px] border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-paper"
        >
          <ScoreRing value={fairness.score} label="Fairness score" size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Fairness check</span>
            <span className="block text-xs text-ink-3">{fairnessSummary}</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-brand">Review</span>
        </button>
      </div>
    </div>
  );
}
