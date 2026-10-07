"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconArrowRight, IconCheck, IconChevronRight } from "@/components/icons";
import { Button } from "@/components/app/ui/button";
import { SelectField, TextField } from "@/components/app/ui/field";
import { Segmented } from "@/components/app/ui/tabs";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage } from "@/components/app/ui/toast";
import { CurrencySelect } from "@/components/shared/currency-select";
import { EASE, gsap, reducedMotion } from "@/lib/motion";
import { SELF_SERVE_PLANS, currencyInfo, formatPrice, planById, planPrice, type Currency } from "@/lib/plans";
import { DATA_REGIONS, regionLabel } from "@/lib/regions";
import { TEAM_SIZES, type Organization, type PlanId, type TeamSize, type WorkspaceKind } from "@/lib/types";
import { createWorkspace, type OnboardState } from "./actions";

type Region = Organization["dataRegion"];
type Interval = "monthly" | "annual";
type Errors = Partial<Record<string, string>>;

const STEPS = [
  { id: "use", title: "Who it's for" },
  { id: "workspace", title: "Workspace" },
  { id: "site", title: "First site" },
  { id: "plan", title: "Plan" },
  { id: "review", title: "Review" },
] as const;
const LAST = STEPS.length - 1;

/** Which step owns each server-side field error, so a rejected submit lands on the right step. */
const FIELD_STEP: Record<string, number> = { kind: 0, org: 1, teamSize: 1, dataRegion: 1, site: 2, domain: 2, plan: 3, interval: 3, currency: 3 };

/** Mirrors domainSchema in lib/validation.ts. */
const normalizeDomain = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

/** A sensible starting point from the visitor's time zone; always editable. */
function guessLocale(): { region: Region; currency: Currency } {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return { region: "ap-south-1", currency: "inr" };
  if (tz === "Europe/London") return { region: "eu-central-1", currency: "gbp" };
  if (tz.startsWith("Europe/")) return { region: "eu-central-1", currency: "eur" };
  if (tz.startsWith("America/")) return { region: "us-east-1", currency: "usd" };
  return { region: "ap-south-1", currency: "usd" };
}

const recommendedPlan = (kind: WorkspaceKind | null): PlanId => (kind === "organization" ? "growth" : "free");

/* ---------- small presentational pieces ---------- */

function PersonGlyph() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="14" cy="9.5" r="4.5" />
      <path d="M5.5 23.5c1.2-4.4 4.4-6.8 8.5-6.8s7.3 2.4 8.5 6.8" />
    </svg>
  );
}

function BuildingGlyph() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 24h20M6.5 24V6.5L15 4v20M15 10l6.5 2v12" />
      <path d="M9.5 9.5h2M9.5 13.5h2M9.5 17.5h2M18 15.5h1.5M18 19.5h1.5" />
    </svg>
  );
}

/** Radio rendered as a card; the native input stays in the tab order for keyboard and screen readers. */
function ChoiceCard({
  name,
  checked,
  onSelect,
  children,
  className = "",
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`group relative flex cursor-pointer rounded-[16px] bg-surface p-5 ring-1 transition-[box-shadow,transform,background-color] duration-300 ease-[var(--ease-spring)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand hover:-translate-y-0.5 ${
        checked ? "bg-brand-wash/50 shadow-[0_18px_40px_-26px_rgba(46,43,214,0.55)] ring-2 ring-brand" : "ring-line hover:shadow-[var(--shadow-lift)] hover:ring-line-strong"
      } ${className}`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={`absolute right-4 top-4 grid size-5 place-items-center rounded-full transition-colors ${checked ? "bg-brand text-white" : "ring-1 ring-inset ring-line-strong"}`}
      >
        {checked ? <IconCheck size={12} className="pt-pop" /> : null}
      </span>
      {children}
    </label>
  );
}

function StepRail({ step, maxReached, onJump }: { step: number; maxReached: number; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Setup progress">
      {/* Phones: one line and a bar */}
      <div className="sm:hidden">
        <p className="text-sm font-medium text-ink-2">
          Step {step + 1} of {STEPS.length} <span className="text-ink-3">· {STEPS[step].title}</span>
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[var(--ease-spring)]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>
      {/* Larger screens: every step, completed ones are links back */}
      <ol className="hidden items-center sm:flex">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const reachable = i <= maxReached && !current;
          const dot = (
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                done ? "bg-brand-wash text-brand ring-1 ring-inset ring-brand/25" : current ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(46,43,214,0.7)]" : "bg-surface text-ink-3 ring-1 ring-inset ring-line-strong"
              }`}
            >
              {done ? <IconCheck size={14} className="pt-pop" /> : i + 1}
            </span>
          );
          return (
            <li key={s.id} className="flex flex-1 items-center last:flex-none" aria-current={current ? "step" : undefined}>
              {reachable ? (
                <button type="button" onClick={() => onJump(i)} className="flex items-center gap-2 rounded-full pr-2 text-sm font-medium text-ink-2 hover:text-ink">
                  {dot}
                  <span className="hidden md:inline">{s.title}</span>
                  <span className="sr-only">{done ? " (done)" : ""}, go back to this step</span>
                </button>
              ) : (
                <span className={`flex items-center gap-2 pr-2 text-sm font-medium ${current ? "text-ink" : "text-ink-3"}`}>
                  {dot}
                  <span className="hidden md:inline">{s.title}</span>
                </span>
              )}
              {i < LAST ? (
                <span aria-hidden className="mx-1 h-px flex-1 overflow-hidden bg-line">
                  <span className="block h-full bg-brand transition-[width] duration-500 ease-[var(--ease-spring)]" style={{ width: done ? "100%" : "0%" }} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PlanPrice({ plan, currency, interval }: { plan: PlanId; currency: Currency; interval: Interval }) {
  const monthly = planPrice(planById(plan), currency) ?? 0;
  if (monthly === 0)
    return (
      <span className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-[-0.03em]">{formatPrice(0, currency)}</span>
        <span className="text-xs text-ink-3">forever</span>
      </span>
    );
  const perMonth = interval === "annual" ? (monthly * 10) / 12 : monthly;
  return (
    <span className="block">
      <span className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em]">{formatPrice(perMonth, currency)}</span>
        <span className="text-xs text-ink-3">/ month</span>
      </span>
      <span className="mt-0.5 block text-xs text-ink-3">{interval === "annual" ? `${formatPrice(monthly * 10, currency)} billed yearly` : "Billed monthly"}</span>
    </span>
  );
}

/** A browser window with the visitor's domain and a miniature banner, so the site step feels concrete. */
function SitePreview({ domain }: { domain: string }) {
  const shown = normalizeDomain(domain) || "yourdomain.com";
  return (
    <div aria-hidden className="overflow-hidden rounded-[14px] bg-surface shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-3 py-2">
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1 text-center font-mono text-[11px] text-ink-2 ring-1 ring-line">{shown}</span>
      </div>
      <div className="relative h-40 bg-[linear-gradient(180deg,var(--color-paper),var(--color-surface))] p-4">
        <span className="block h-2 w-1/2 rounded-full bg-line" />
        <span className="mt-2 block h-2 w-1/3 rounded-full bg-line" />
        <div className="absolute inset-x-3 bottom-3 rounded-[10px] bg-surface p-3 shadow-[var(--shadow-lift)] ring-1 ring-line">
          <span className="block text-[11px] font-semibold text-ink">{shown} uses cookies</span>
          <span className="mt-1.5 block h-1.5 w-full rounded-full bg-line" />
          {/* Reject and Accept carry equal weight, as on the real banner */}
          <span className="mt-2.5 grid grid-cols-3 gap-1.5">
            <span className="h-5 rounded-md bg-brand" />
            <span className="h-5 rounded-md ring-1 ring-line-strong" />
            <span className="h-5 rounded-md bg-brand" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- the wizard ---------- */

export function OnboardingForm({ userName, initialPlan, initialKind }: { userName?: string; initialPlan?: PlanId; initialKind?: WorkspaceKind }) {
  const [state, action] = useActionState<OnboardState, FormData>(createWorkspace, null);
  const [step, setStep] = useState(initialKind ? 1 : 0);
  const [maxReached, setMaxReached] = useState(step);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [errors, setErrors] = useState<Errors>({});

  const [kind, setKind] = useState<WorkspaceKind | null>(initialKind ?? null);
  const [org, setOrg] = useState("");
  const [teamSize, setTeamSize] = useState<TeamSize | "">("");
  const [region, setRegion] = useState<Region>("ap-south-1");
  const [site, setSite] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<PlanId | null>(initialPlan ?? null);
  const [interval, setInterval] = useState<Interval>("monthly");
  const [currency, setCurrency] = useState<Currency>("usd");
  const localeApplied = useRef(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const uid = useId();
  const chosenPlan = plan ?? recommendedPlan(kind);
  const paid = chosenPlan !== "free";
  const firstName = userName?.split(" ")[0];

  // A rejected submit: show the server's errors on the step that owns the first one.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    const fe = state?.fieldErrors;
    if (fe) {
      const next: Errors = {};
      for (const [k, v] of Object.entries(fe)) if (v?.[0]) next[k] = v[0];
      setErrors(next);
      const target = Math.min(...Object.keys(next).map((k) => FIELD_STEP[k] ?? LAST));
      if (Number.isFinite(target)) {
        setDir("back");
        setStep(target);
      }
    }
  }

  // The new step slides in from the side you're heading to, then its parts settle in order.
  const stepRef = useRef<HTMLDivElement>(null);
  const animated = useRef(false);
  useLayoutEffect(() => {
    const el = stepRef.current;
    if (!animated.current) {
      animated.current = true;
      return;
    }
    if (!el || reducedMotion()) return;
    const from = dir === "fwd" ? 36 : -36;
    const tl = gsap.timeline({ defaults: { ease: EASE } });
    tl.fromTo(el, { x: from, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, clearProps: "transform,opacity" });
    tl.fromTo(
      el.querySelectorAll("header, .grid > *, .space-y-5 > *, dl > div, fieldset > div"),
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, clearProps: "transform,opacity" },
      0.08,
    );
    return () => {
      tl.kill();
    };
  }, [step, dir]);

  // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function validate(i: number): Errors {
    const e: Errors = {};
    if (i === 0 && !kind) e.kind = "Choose who this workspace is for.";
    if (i === 1) {
      if (org.trim().length < 2) e.org = kind === "personal" ? "Name your workspace." : "Enter your organization's name.";
      if (kind === "organization" && !teamSize) e.teamSize = "Choose your team size.";
    }
    if (i === 2) {
      if (site.trim().length < 2) e.site = "Name your first site.";
      if (!DOMAIN_RE.test(normalizeDomain(domain))) e.domain = "Enter a domain like example.com, without https://";
    }
    return e;
  }

  function go(to: number) {
    setDir(to > step ? "fwd" : "back");
    setStep(to);
    setMaxReached((m) => Math.max(m, to));
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      // Focus the first invalid control.
      const key = Object.keys(e)[0];
      requestAnimationFrame(() => document.getElementById(`${uid}-${key}`)?.focus());
      return;
    }
    if (step === 0 && !localeApplied.current) {
      localeApplied.current = true;
      const guess = guessLocale();
      setRegion(guess.region);
      setCurrency(guess.currency);
      if (kind === "personal" && !org && firstName) setOrg(`${firstName}'s sites`);
    }
    go(step + 1);
  }

  const fieldId = (k: string) => `${uid}-${k}`;
  const heading = (title: string, lead: ReactNode) => (
    <header className="mb-7">
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.5rem] font-semibold tracking-[-0.025em] outline-none sm:text-[1.75rem]">
        {title}
      </h2>
      <p className="mt-1.5 text-[15px] text-ink-2">{lead}</p>
    </header>
  );

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        if (step < LAST) {
          e.preventDefault();
          next();
        }
      }}
    >
      {/* What the server receives; the visible controls below are display-only and unnamed. */}
      <input type="hidden" name="kind" value={kind ?? ""} />
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="teamSize" value={kind === "organization" ? teamSize : ""} />
      <input type="hidden" name="dataRegion" value={region} />
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="domain" value={domain} />
      <input type="hidden" name="plan" value={chosenPlan} />
      <input type="hidden" name="interval" value={interval} />
      <input type="hidden" name="currency" value={currency} />

      <StepRail step={step} maxReached={maxReached} onJump={go} />

      <div className="mt-8 rounded-[22px] bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-8">
        <div key={step} ref={stepRef}>
          {step === 0 ? (
            <fieldset aria-describedby={errors.kind ? fieldId("kind-error") : undefined}>
              <legend className="sr-only">Who is this workspace for?</legend>
              {heading(
                firstName ? `Welcome, ${firstName}. Who's this for?` : "Who's this workspace for?",
                "We'll tailor the setup and suggest a plan. You can invite a team or change plans later.",
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { value: "personal", title: "Just me", body: "A personal site, blog, portfolio or side project.", Glyph: PersonGlyph },
                    { value: "organization", title: "A company or agency", body: "Your business's sites, with a team, roles and audit trail.", Glyph: BuildingGlyph },
                  ] as const
                ).map((o, i) => (
                  <ChoiceCard key={o.value} name={`${uid}-kind`} checked={kind === o.value} onSelect={() => setKind(o.value)} className="min-h-40 flex-col">
                    <span
                      id={i === 0 ? fieldId("kind") : undefined}
                      className={`grid size-12 place-items-center rounded-[12px] ring-1 ring-inset transition-colors ${kind === o.value ? "bg-brand text-white ring-brand" : "bg-paper text-ink-2 ring-line"}`}
                    >
                      <o.Glyph />
                    </span>
                    <span className="mt-4 block text-base font-semibold text-ink">{o.title}</span>
                    <span className="mt-1 block pr-4 text-sm text-ink-3">{o.body}</span>
                  </ChoiceCard>
                ))}
              </div>
              {errors.kind ? (
                <p id={fieldId("kind-error")} role="alert" className="mt-3 text-sm font-bold text-rose">
                  {errors.kind}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {step === 1 ? (
            <div>
              {heading(
                kind === "personal" ? "Name your workspace" : "Tell us about your organization",
                kind === "personal"
                  ? "Your workspace holds your sites and consent records."
                  : "An organization holds your sites, team, billing and consent records. Agencies usually create one per client.",
              )}
              <div className="space-y-5">
                <TextField
                  id={fieldId("org")}
                  name=""
                  label={kind === "personal" ? "Workspace name" : "Organization name"}
                  placeholder={kind === "personal" ? "My sites" : "Acme Retail Pvt Ltd"}
                  autoComplete={kind === "personal" ? "off" : "organization"}
                  maxLength={80}
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  error={errors.org}
                />
                {kind === "organization" ? (
                  <fieldset aria-describedby={errors.teamSize ? fieldId("teamSize-error") : undefined}>
                    <legend className="label">Team size</legend>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {TEAM_SIZES.map((s, i) => (
                        <label
                          key={s}
                          className={`inline-flex h-11 min-w-16 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                            teamSize === s ? "bg-brand text-white ring-brand" : "bg-surface text-ink-2 ring-line-strong hover:bg-paper"
                          }`}
                        >
                          <input
                            id={i === 0 ? fieldId("teamSize") : undefined}
                            type="radio"
                            name={`${uid}-team`}
                            checked={teamSize === s}
                            onChange={() => setTeamSize(s)}
                            className="sr-only"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                    {errors.teamSize ? (
                      <p id={fieldId("teamSize-error")} className="mt-1.5 text-xs font-bold text-rose">
                        {errors.teamSize}
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}
                <SelectField
                  id={fieldId("dataRegion")}
                  name=""
                  label="Where consent records are stored"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                  options={DATA_REGIONS.map((r) => ({ value: r.id, label: r.label }))}
                  hint="Pick Mumbai or Hyderabad to keep Indian visitors' records in India. This can't be changed later."
                  error={errors.dataRegion}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              {heading("Add your first site", "We'll give you a single script tag for it next. You can add more sites later.")}
              <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)] md:items-start">
                <div className="space-y-5">
                  <TextField
                    id={fieldId("site")}
                    name=""
                    label="Site name"
                    placeholder="Acme storefront"
                    maxLength={60}
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    error={errors.site}
                  />
                  <TextField
                    id={fieldId("domain")}
                    name=""
                    label="Domain"
                    placeholder="acme.in"
                    inputMode="url"
                    autoCapitalize="none"
                    autoComplete="url"
                    spellCheck={false}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    hint="Subdomains are covered automatically."
                    error={errors.domain}
                  />
                </div>
                <SitePreview domain={domain} />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <fieldset>
              <legend className="sr-only">Choose a plan</legend>
              {heading(
                "Choose your plan",
                kind === "organization" ? "Most teams start on Growth for the Evidence Pack and roles. Free is always there." : "Free covers a personal site for good. Upgrade whenever you need more.",
              )}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  label="Billing period"
                  value={interval}
                  onChange={setInterval}
                  options={[
                    { value: "monthly", label: "Monthly" },
                    { value: "annual", label: "Yearly, 2 months free" },
                  ]}
                />
                <CurrencySelect size="sm" value={currency} onChange={setCurrency} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {SELF_SERVE_PLANS.map((p) => {
                  const recommended = p.id === recommendedPlan(kind);
                  return (
                    <ChoiceCard key={p.id} name={`${uid}-plan`} checked={chosenPlan === p.id} onSelect={() => setPlan(p.id)} className="flex-col">
                      <span className="flex flex-wrap items-center gap-2 pr-7">
                        <span className="text-base font-semibold text-ink">{p.name}</span>
                        {recommended ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Recommended</span> : null}
                        {initialPlan === p.id && !recommended ? <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-2">Your pick</span> : null}
                      </span>
                      <span className="mt-1 block text-sm text-ink-3">{p.summary}</span>
                      <span className="mt-4 block">
                        <PlanPrice plan={p.id} currency={currency} interval={interval} />
                      </span>
                      <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
                        {p.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex gap-2">
                            <IconCheck size={14} className="mt-0.5 shrink-0 text-jade" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </ChoiceCard>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-ink-3">
                {currency !== "usd" ? `${currencyInfo(currency).code} prices are ${currencyInfo(currency).tax}. ` : ""}
                Need SSO, custom volume or an SLA?{" "}
                <Link href="/contact-sales" className="font-medium text-brand underline-offset-4 hover:underline">
                  Talk to sales about Enterprise
                </Link>
                .
              </p>
            </fieldset>
          ) : null}

          {step === 4 ? (
            <div>
              {heading("Review and create", paid ? "Check the details, then confirm payment securely on Stripe." : "Check the details. Your banner can be live in about five minutes.")}
              <dl className="divide-y divide-line overflow-hidden rounded-[14px] ring-1 ring-line">
                {[
                  { k: "Type", v: kind === "personal" ? "Personal workspace" : `Organization${teamSize ? `, ${teamSize} people` : ""}`, to: 0 },
                  { k: kind === "personal" ? "Workspace" : "Organization", v: org, to: 1 },
                  { k: "Data region", v: regionLabel(region), to: 1 },
                  { k: "First site", v: `${site} · ${normalizeDomain(domain)}`, to: 2 },
                  {
                    k: "Plan",
                    v: paid
                      ? `${planById(chosenPlan).name}, ${formatPrice(
                          interval === "annual" ? (planPrice(planById(chosenPlan), currency) ?? 0) * 10 : (planPrice(planById(chosenPlan), currency) ?? 0),
                          currency,
                        )} ${interval === "annual" ? "a year" : "a month"}`
                      : "Free, for good",
                    to: 3,
                  },
                ].map((r) => (
                  <div key={r.k} className="flex items-center gap-3 bg-surface py-2 pl-4 pr-2 sm:gap-4 sm:py-3">
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                      <dt className="text-xs text-ink-3 sm:w-28 sm:shrink-0 sm:text-sm">{r.k}</dt>
                      <dd className="mt-0.5 break-words text-sm font-medium text-ink sm:mt-0 sm:min-w-0 sm:flex-1">{r.v}</dd>
                    </div>
                    <dd className="shrink-0">
                      <button type="button" onClick={() => go(r.to)} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-brand hover:bg-brand-wash">
                        Edit<span className="sr-only"> {r.k.toLowerCase()}</span>
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
              {paid ? (
                <p className="mt-4 flex gap-2 rounded-[12px] bg-paper px-4 py-3 text-sm text-ink-2 ring-1 ring-inset ring-line">
                  <IconChevronRight size={16} className="mt-0.5 shrink-0 text-brand" />
                  We create your workspace first, so your site is protected on Free straight away. {planById(chosenPlan).name} applies as soon as Stripe confirms payment.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6" aria-live="polite">
          <FormMessage state={state && !state.fieldErrors ? state : null} />
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => go(step - 1)} className="w-full sm:w-auto">
              Back
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          {step < LAST ? (
            <Button type="submit" className="w-full gap-2 sm:w-auto">
              Continue
              <IconArrowRight size={16} />
            </Button>
          ) : (
            <SubmitButton className="w-full sm:w-auto" pending={paid ? "Opening secure checkout" : "Creating workspace"}>
              {paid ? `Create workspace and pay` : "Create workspace"}
            </SubmitButton>
          )}
        </div>
      </div>
    </form>
  );
}
