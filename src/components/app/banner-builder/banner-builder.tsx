"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { publishSite, saveConfig } from "@/app/app/sites/[propertyId]/actions";
import type { ActionResult } from "@/lib/action-result";
import {
  CATEGORY_ICONS,
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDesktop,
  IconLayoutBar,
  IconLayoutModal,
  IconLayoutPill,
  IconLayoutToast,
  IconMobileApp,
} from "@/components/icons";
import { contrastRatio, isHex } from "@/lib/color";
import { blockedCss, CUSTOM_CSS_MAX } from "@/lib/custom-css";
import { evaluateFairness, fixHref } from "@/lib/fairness";
import { FRAMEWORK_META } from "@/lib/defaults";
import { toPublicConfig } from "@/lib/public-config";
import type { BannerConfig, BannerCopy, Framework, Layout, Position, Property } from "@/lib/types";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { Segmented, TabPanel, Tabs } from "@/components/app/ui/tabs";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { DescriptionList } from "@/components/app/ui/description-list";
import { SelectField, TextAreaField, TextField } from "@/components/app/ui/field";
import { StatusDot } from "@/components/app/ui/status-dot";
import { Switch } from "@/components/app/ui/switch";
import { ChipInput } from "@/components/app/ui/chip-input";
import { CheckList, ScoreRing } from "@/components/app/compliance/check-list";
import { LearnMore } from "@/components/app/configure/learn-more";

type Draft = Omit<BannerConfig, "version">;

const LAYOUTS: { id: Layout; label: string; icon: typeof IconLayoutBar; positions: Position[] }[] = [
  { id: "bar", label: "Bottom bar", icon: IconLayoutBar, positions: ["bottom", "top"] },
  { id: "modal", label: "Center modal", icon: IconLayoutModal, positions: ["center"] },
  { id: "toast", label: "Corner toast", icon: IconLayoutToast, positions: ["bottom-left", "bottom-right"] },
  { id: "pill", label: "Floating pill", icon: IconLayoutPill, positions: ["bottom"] },
];
const POSITION_LABEL: Record<Position, string> = {
  bottom: "Bottom",
  top: "Top",
  center: "Center",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};
/** The preview frame's own origin: preview messages go only there and are only accepted from there. */
function frameOrigin(f: HTMLIFrameElement | null) {
  try {
    return new URL(f?.src || "/preview-frame", window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

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
      <div className="flex h-10 items-center gap-2 rounded-md border border-boundary bg-surface pl-1.5 pr-3 transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:border-ink">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-7 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 focus-visible:outline-none [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-line-strong [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          className="w-full min-w-0 bg-transparent font-mono text-sm uppercase text-ink outline-none focus-visible:outline-none"
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
    <p className={`flex items-start gap-1.5 text-xs ${ok ? "text-ink-3" : "font-medium text-destructive"}`}>
      {ok ? <IconCheck size={14} aria-hidden className="mt-px shrink-0" /> : <IconAlert size={14} aria-hidden className="mt-px shrink-0" />}
      {what}: <span className="tabular-nums">{r.toFixed(1)}:1</span>
      {ok ? (r >= 7 ? " passes AAA" : " passes AA") : " is below the 4.5:1 minimum. Visitors with low vision may not be able to read it."}
    </p>
  );
}

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line px-5 py-5 last:border-b-0 sm:px-6">
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
  const toast = useToast();
  const frame = useRef<HTMLIFrameElement>(null);

  const unsaved = JSON.stringify(draft) !== JSON.stringify(initial);
  const unpublished = property.config.version !== property.publishedVersion;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setTheme = <K extends keyof Draft["theme"]>(k: K, v: Draft["theme"][K]) => setDraft((d) => ({ ...d, theme: { ...d.theme, [k]: v } }));
  const setCopy = (fw: Framework, k: keyof BannerCopy, v: string) =>
    setDraft((d) => ({ ...d, regions: { ...d.regions, [fw]: { ...d.regions[fw], copy: { ...d.regions[fw].copy, [k]: v } } } }));

  const send = useCallback(() => {
    const cfg = toPublicConfig({ ...property, config: { ...draft, version: property.config.version } }, dpo);
    frame.current?.contentWindow?.postMessage({ type: "plain:preview", config: cfg, framework }, frameOrigin(frame.current));
  }, [draft, framework, property, dpo]);

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

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!unsaved) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  // success is a toast; an error stays inline above the actions
  const settle = (r: ActionResult) => {
    setState(r);
    if (r?.ok) toast(r.ok);
  };
  const save = () => start(async () => settle(await saveConfig(property.id, draft)));
  const publish = () =>
    start(async () => {
      if (unsaved) {
        const r = await saveConfig(property.id, draft);
        if (r?.error) return setState(r);
      }
      settle(await publishSite(property.id));
    });

  const strictRegions = (["gdpr", "dpdpa"] as const).filter((f) => draft.regions[f].enabled);
  const fairness = useMemo(() => evaluateFairness(draft, { dpoEmail: dpo?.email }), [draft, dpo?.email]);
  const blocked = fairness.failures.length > 0;
  const cssBlocked = useMemo(() => blockedCss(draft.theme.customCss ?? ""), [draft.theme.customCss]);
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

  const stepItems = STEPS.map((x) => {
    const issues = issuesFor(x.id);
    return {
      value: x.id,
      label: (
        <span className="inline-flex items-center gap-2">
          {x.label}
          {issues.fail ? (
            <StatusDot tone="bad" size={7} label={`${issues.fail} failing`} />
          ) : issues.warn ? (
            <StatusDot tone="warn" size={7} label={`${issues.warn} to review`} />
          ) : null}
        </span>
      ),
    };
  });
  const updateCategory = (i: number, patch: Partial<Draft["categories"][number]>) => set("categories", draft.categories.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const linked = [
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
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      {/* controls: above the preview on phones and tablets, beside it on wide screens */}
      <div ref={controls} className="min-w-0 scroll-mt-20 self-start overflow-hidden rounded-lg border border-line bg-surface">
        <Tabs<BuilderTab> label="Banner setup steps" idBase="banner" items={stepItems} value={tab} onChange={setTab} />

        <TabPanel idBase="banner" value={tab}>
          <p className="px-5 pt-4 text-sm text-ink-3 sm:px-6">{STEPS[idx].hint}</p>
          <fieldset disabled={!canWrite} className="min-w-0">
            <legend className="sr-only">{STEPS[idx].label} settings</legend>
            {tab === "design" ? (
              <>
                <Section title="Layout">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Layout">
                    {LAYOUTS.map((l) => {
                      const active = l.id === draft.theme.layout;
                      // Native radios give arrow-key movement and form semantics for free.
                      return (
                        <label
                          key={l.id}
                          className={`relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border px-2 py-3 text-xs transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                            active ? "border-ink bg-selected font-semibold text-on-selected" : "border-line font-medium text-ink-2 hover:border-boundary hover:text-ink"
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
                          {active ? (
                            <span aria-hidden className="absolute right-1.5 top-1.5">
                              <IconCheck size={14} />
                            </span>
                          ) : null}
                          <l.icon size={28} strokeWidth={1.5} aria-hidden />
                          {l.label}
                        </label>
                      );
                    })}
                  </div>
                  {draft.theme.layout === "pill" ? <p className="text-xs text-ink-3">A small pill that opens to the notice. Reject and Accept always look the same in it.</p> : null}
                  {layout.positions.length > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                <Section title="Colours">
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
                    <input
                      id="radius"
                      type="range"
                      min={0}
                      max={28}
                      value={draft.theme.radius}
                      aria-valuetext={`${draft.theme.radius} pixels`}
                      onChange={(e) => setTheme("radius", Number(e.target.value))}
                      className="h-10 w-full cursor-pointer accent-interactive"
                    />
                  </div>
                  <SelectField<Draft["theme"]["font"]>
                    id="font"
                    label="Font"
                    value={draft.theme.font}
                    onValueChange={(v) => setTheme("font", v)}
                    options={[
                      { value: "system", label: "System UI", description: "Fastest: nothing to download" },
                      { value: "inherit", label: "Inherit from my site", description: "Uses your site's body font" },
                      { value: "serif", label: "Serif" },
                      { value: "mono", label: "Monospace" },
                    ]}
                  />
                </Section>
                <Section title="Fair choice">
                  <Switch
                    label="Equal-weight buttons"
                    description="Reject looks exactly like Accept. Regulators treat a faded or hidden reject button as a dark pattern."
                    checked={draft.theme.equalButtons}
                    onChange={(v) => setTheme("equalButtons", v)}
                  />
                  {!draft.theme.equalButtons && strictRegions.length ? (
                    <Alert tone="danger" title="Refusing must be as easy as accepting">
                      {strictRegions.map((f) => FRAMEWORK_META[f].name).join(" and ")} require it. Turn this back on unless only CCPA regions are enabled.
                    </Alert>
                  ) : null}
                </Section>
                <Section title="Custom CSS" description="Applied after the built-in styles, inside the banner only, so it never touches your site.">
                  <TextAreaField
                    id="custom-css"
                    label="Stylesheet"
                    rows={6}
                    controlClassName="font-mono text-xs"
                    spellCheck={false}
                    placeholder={".b { box-shadow: none; }\nh2 { letter-spacing: 0; }"}
                    value={draft.theme.customCss ?? ""}
                    maxLength={CUSTOM_CSS_MAX}
                    aside={
                      <span className="text-xs tabular-nums text-ink-3">
                        {(draft.theme.customCss ?? "").length} / {CUSTOM_CSS_MAX}
                      </span>
                    }
                    hint="No @import, url(), expression() or escapes; !important is ignored. Reject and Accept can't be hidden."
                    error={cssBlocked.length ? `Remove ${cssBlocked.join(", ")} to save. The preview leaves them out.` : undefined}
                    onChange={(e) => setTheme("customCss", e.target.value || undefined)}
                  />
                </Section>
              </>
            ) : null}

            {tab === "text" ? (
              <>
                <Section title="Wording per region" description="Write it the way you'd say it to a customer.">
                  <Segmented size="sm" label="Region" value={framework} onChange={setFramework} options={FRAMEWORKS.map((f) => ({ value: f, label: FRAMEWORK_META[f].name }))} />
                  {!draft.regions[framework].enabled ? (
                    <Alert tone="warning" title="This region is turned off">
                      Visitors won&apos;t see this text until it&apos;s turned on in Regions.
                    </Alert>
                  ) : null}
                  {COPY_FIELDS.map((f) => {
                    const v = draft.regions[framework].copy[f.key];
                    const fid = `copy-${framework}-${f.key}`;
                    return f.long ? (
                      <TextAreaField
                        key={fid}
                        id={fid}
                        label={f.label}
                        rows={4}
                        maxLength={600}
                        value={v}
                        aside={<span className="text-xs tabular-nums text-ink-3">{v.length} / 600</span>}
                        onChange={(e) => setCopy(framework, f.key, e.target.value)}
                      />
                    ) : (
                      <TextField key={fid} id={fid} label={f.label} maxLength={f.key === "title" ? 80 : 60} value={v} onChange={(e) => setCopy(framework, f.key, e.target.value)} />
                    );
                  })}
                </Section>
                <Section title="Policy link">
                  <TextField id="policy" label="Privacy or cookie policy URL" type="url" value={draft.policyUrl} onChange={(e) => set("policyUrl", e.target.value)} />
                </Section>
              </>
            ) : null}

            {tab === "categories" ? (
              <Section title="Purposes" description="Visitors see these in the preferences view.">
                {draft.categories.map((c, i) => {
                  const Icon = CATEGORY_ICONS[c.id];
                  return (
                    <div key={c.id} className="space-y-3 rounded-md border border-line p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                          <Icon size={16} aria-hidden />
                          {c.label || "Untitled purpose"}
                        </span>
                        {c.required ? <Badge tone="released">Always on</Badge> : <Badge tone="held">Held until consent</Badge>}
                      </div>
                      <TextField id={`cat-${c.id}`} label="Name" value={c.label} maxLength={40} onChange={(e) => updateCategory(i, { label: e.target.value })} />
                      <TextAreaField id={`cat-${c.id}-d`} label="What it does" rows={2} value={c.description} maxLength={300} onChange={(e) => updateCategory(i, { description: e.target.value })} />
                      <ChipInput
                        id={`cat-${c.id}-items`}
                        label="Personal data collected"
                        hint={c.required ? "Shown so visitors know what even essential cookies hold." : "DPDPA requires an itemised list for each purpose. Press Enter after each item."}
                        values={c.dataItems ?? []}
                        disabled={!canWrite}
                        onChange={(v) => updateCategory(i, { dataItems: v })}
                      />
                      <TextField id={`cat-${c.id}-ret`} label="Kept for" value={c.retention ?? ""} maxLength={80} placeholder="e.g. 13 months" onChange={(e) => updateCategory(i, { retention: e.target.value })} />
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
                    description={
                      <>
                        Send ad_storage, analytics_storage, ad_user_data and ad_personalization signals to Google tags. <LearnMore anchor="consent-mode" topic="Google Consent Mode" />
                      </>
                    }
                    checked={draft.googleConsentMode}
                    onChange={(v) => set("googleConsentMode", v)}
                  />
                </Section>
                <Section title="Re-asking">
                  <TextField
                    id="expiry"
                    label="Ask again after (days)"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={395}
                    className="max-w-40"
                    controlClassName="tabular-nums"
                    value={draft.expiryDays}
                    hint="Many EU regulators expect 6 to 13 months. We also ask again whenever categories change."
                    onChange={(e) => set("expiryDays", Math.max(1, Math.min(395, Number(e.target.value) || 1)))}
                  />
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
                          <details className="group rounded-md border border-line">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm text-ink-2 hover:text-ink">
                              <span className="inline-flex items-center gap-2">
                                <IconCheck size={14} aria-hidden className="text-success" />
                                {passing.length} check{passing.length === 1 ? "" : "s"} passing
                              </span>
                              <IconChevronDown size={14} aria-hidden className="text-ink-3 transition-transform duration-150 group-open:rotate-180" />
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
                <Section title="Details your notice links to" description="Kept on other pages because they're shared. Your notice shows them as they are now.">
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {linked.map((row) => (
                      <li key={row.label} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                            {row.label}
                            {row.value ? null : row.required ? <Badge tone="danger">Missing</Badge> : <Badge tone="warning">Not set</Badge>}
                          </span>
                          <span className={`mt-0.5 block break-words text-xs ${row.value ? "text-ink-2" : "text-ink-3"}`}>{row.value ?? row.missing}</span>
                        </span>
                        <ButtonLink href={row.href} variant="quiet" size="sm" className="shrink-0">
                          {row.value ? "Edit" : "Add"}
                          <span className="sr-only"> {row.label}</span>
                        </ButtonLink>
                      </li>
                    ))}
                  </ul>
                </Section>
                <Section title="Versions">
                  <DescriptionList
                    columns={2}
                    items={[
                      {
                        label: "Live for visitors",
                        value: (
                          <>
                            {property.publishedVersion ? `v${property.publishedVersion}` : "Nothing yet"}
                            {property.publishedAt ? <span className="block text-xs font-normal text-ink-3">{new Date(property.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span> : null}
                          </>
                        ),
                      },
                      {
                        label: "Your draft",
                        value: (
                          <>
                            v{property.config.version}
                            <span className="block text-xs font-normal text-ink-3">{unsaved ? "With unsaved edits" : nothingNew ? "Same as live" : "Saved, ready to publish"}</span>
                          </>
                        ),
                      },
                    ]}
                  />
                </Section>
              </>
            ) : null}
          </fieldset>
        </TabPanel>

        {canWrite ? (
          <div className="sticky bottom-0 z-10 space-y-3 border-t border-line bg-surface px-5 py-4 sm:px-6">
            <FormMessage state={state?.error ? { error: state.error } : null} />
            {tab === "review" && (blocked || nothingNew) ? (
              <p id="publish-why" className={`flex items-start gap-2 text-xs ${blocked ? "font-medium text-destructive" : "text-ink-3"}`}>
                {blocked ? <IconAlert size={14} aria-hidden className="mt-px shrink-0" /> : null}
                {blocked
                  ? `Fix ${fairness.failures.length === 1 ? "the failing check" : `the ${fairness.failures.length} failing checks`} above before publishing.`
                  : "Nothing new to publish: visitors already see this version."}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="inline-flex items-center gap-2 text-xs text-ink-3" aria-live="polite">
                <StatusDot tone={unsaved ? "warn" : unpublished ? "idle" : "ok"} label={unsaved ? "Unsaved" : unpublished ? "Not live" : "Live"} size={7} />
                {status}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              {idx > 0 ? (
                <Button variant="quiet" onClick={() => go(idx - 1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={save} disabled={pending || !unsaved}>
                  Save draft
                </Button>
                {tab !== "review" ? (
                  <Button onClick={() => go(idx + 1)}>
                    <span className="max-sm:hidden">Next: </span>
                    {STEPS[idx + 1].label}
                  </Button>
                ) : (
                  <Button onClick={publish} loading={pending} loadingLabel="Publishing" disabled={nothingNew || blocked} aria-describedby={blocked || nothingNew ? "publish-why" : undefined}>
                    Publish
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="border-t border-line px-5 py-4 text-sm text-ink-3 sm:px-6">You have view access. Ask an admin to change the banner.</p>
        )}
      </div>

      {/* preview */}
      <section aria-labelledby="preview-h" className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <h2 id="preview-h" className="sr-only">
          Live preview
        </h2>
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
        <div className="overflow-hidden rounded-lg border border-line bg-raised p-2 sm:p-4">
          <div className="mx-auto overflow-hidden rounded-md border border-line-strong bg-surface transition-[max-width] duration-300 ease-out" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <div className="flex h-8 items-center gap-1.5 border-b border-line bg-raised px-3" aria-hidden>
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="ml-3 truncate rounded-sm bg-surface px-2 py-0.5 text-xs text-ink-3">{property.domain}</span>
            </div>
            <iframe ref={frame} src="/preview-frame" title={`Banner preview for ${FRAMEWORK_META[framework].region}`} className="block h-[480px] w-full bg-surface sm:h-[560px]" onLoad={send} />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          {FRAMEWORK_META[framework].name} notice ({FRAMEWORK_META[framework].region}), with your unsaved edits. Visitors see the last published version.
        </p>

        <button
          type="button"
          onClick={() => go(TABS.indexOf("review"))}
          className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 hover:bg-raised"
        >
          <ScoreRing value={fairness.score} label="Fairness score" size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Fairness check</span>
            <span className="block text-xs text-ink-3">{fairnessSummary}</span>
          </span>
          <IconChevronRight size={16} aria-hidden className="shrink-0 text-ink-3" />
        </button>
      </section>
    </div>
  );
}
