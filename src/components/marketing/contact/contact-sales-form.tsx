"use client";

import { useActionState, useRef } from "react";
import { contactSales, type ContactState } from "@/app/(marketing)/contact-sales/actions";
import { SelectField, TextAreaField, TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage } from "@/components/app/ui/toast";
import { RequestSuccess } from "./request-ui";

const SITES = [
  { value: "", label: "Choose" },
  { value: "1", label: "1 website" },
  { value: "2-10", label: "2 to 10" },
  { value: "11-50", label: "11 to 50" },
  { value: "50+", label: "More than 50" },
];
const PAGEVIEWS = [
  { value: "", label: "Choose" },
  { value: "<100k", label: "Under 100k" },
  { value: "100k-1m", label: "100k to 1 million" },
  { value: "1m-10m", label: "1 to 10 million" },
  { value: "10m+", label: "More than 10 million" },
];
const REGIONS = [
  { value: "eu", label: "Europe and UK" },
  { value: "us", label: "United States" },
  { value: "in", label: "India" },
  { value: "other", label: "Elsewhere" },
];

/** Mirrors leadSchema in lib/leads.ts (the server is the source of truth). */
const MAX = { name: 120, company: 160, email: 254, message: 2000 };

export function ContactSalesForm({ formToken }: { formToken: string }) {
  const [state, action] = useActionState<ContactState, FormData>(contactSales, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  const v = state?.values ?? {};
  const fe = state?.fieldErrors ?? {};
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const chosenRegions = Array.isArray(v.regions) ? v.regions : [];

  if (state?.ok) {
    return (
      <RequestSuccess
        message={state.ok}
        reference={state.reference}
        next={[
          "Someone from our sales team reads your request and checks your sites and regions.",
          "We reply by email with pricing, or with times for a walkthrough on your own site.",
          "Enterprise terms, DPA and security review documents follow once you're ready.",
        ]}
      />
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <FormGuard token={state?.formToken ?? formToken} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="name"
          name="name"
          label="Full name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={MAX.name}
          defaultValue={str("name")} error={fe.name} />
        <TextField
          id="company"
          name="company"
          label="Company"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={MAX.company}
          defaultValue={str("company")} error={fe.company} />
      </div>
      <TextField
        id="email"
        name="email"
        type="email"
        label="Work email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={MAX.email}
        defaultValue={str("email")} error={fe.email} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField id="sites" name="sites" label="Websites" options={SITES} defaultValue={str("sites") ?? ""} error={fe.sites} required />
        <SelectField id="pageviews" name="pageviews" label="Monthly pageviews" options={PAGEVIEWS} defaultValue={str("pageviews") ?? ""} error={fe.pageviews} required />
      </div>

      <fieldset aria-describedby={fe.regions ? "regions-error" : undefined}>
        <legend className="label">Where your visitors are</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {REGIONS.map((r) => (
            <label
              key={r.value}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border border-line-strong px-3 text-sm transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
            >
              <input
                type="checkbox"
                name="regions"
                value={r.value}
                defaultChecked={chosenRegions.includes(r.value)}
                aria-invalid={fe.regions ? true : undefined}
                aria-describedby={fe.regions ? "regions-error" : undefined}
                className="size-4 accent-[var(--color-ink)]"
              />
              {r.label}
            </label>
          ))}
        </div>
        {fe.regions ? (
          <p id="regions-error" className="mt-1.5 text-xs font-bold text-rose">
            {fe.regions[0]}
          </p>
        ) : null}
      </fieldset>

      <TextAreaField
        id="message"
        name="message"
        label="What do you need?"
        hint="Optional. For example: DPDPA rollout across 12 sites, data must stay in India."
        rows={4}
        maxLength={MAX.message}
        defaultValue={str("message")}
        error={fe.message}
      />

      <FormMessage state={state?.error ? { error: state.error } : null} />
      <SubmitButton className="w-full" pending="Sending">
        Send request
      </SubmitButton>
      <p className="text-xs leading-relaxed text-ink-3">
        We use these details only to reply to you. See our{" "}
        <a href="/legal/privacy" className="underline underline-offset-2 hover:text-ink">
          privacy notice
        </a>
        .
      </p>
    </form>
  );
}
