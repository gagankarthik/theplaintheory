"use client";

import { useActionState, useRef } from "react";
import { requestEnterprise, type RequestState } from "@/app/(marketing)/contact/actions";
import { SelectField, TextAreaField, TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage } from "@/components/app/ui/toast";
import { COMPANY_SIZES, ENTERPRISE_REQUEST_TYPES, REGION_CHOICES } from "@/lib/lead-options";
import { ChoiceGroup, PrivacyNote, RequestSuccess } from "./request-ui";

/** Mirrors enterpriseSchema in lib/leads.ts (the server is the source of truth). */
const MAX = { name: 120, company: 160, email: 254, message: 2000 };

export function EnterpriseForm({ formToken }: { formToken: string }) {
  const [state, action] = useActionState<RequestState, FormData>(requestEnterprise, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  const v = state?.values ?? {};
  const fe = state?.fieldErrors ?? {};
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const regions = Array.isArray(v.regions) ? v.regions : [];

  if (state?.ok) {
    return (
      <RequestSuccess
        message={state.ok}
        reference={state.reference}
        email={state.email}
        next={[
          "A named contact from our compliance team takes your request.",
          "We send the documents you asked for, or a short call invite if your request needs scoping.",
          "Contract and DPA changes go through review with your legal or procurement team.",
        ]}
      />
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-6">
      <FormGuard token={state?.formToken ?? formToken} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="name" name="name" label="Full name" autoComplete="name" required minLength={2} maxLength={MAX.name} defaultValue={str("name")} error={fe.name} />
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
          defaultValue={str("email")}
          error={fe.email}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="company" name="company" label="Company" autoComplete="organization" required minLength={2} maxLength={MAX.company} defaultValue={str("company")} error={fe.company} />
        <SelectField
          id="companySize"
          name="companySize"
          label="Company size"
          options={[{ value: "", label: "Choose" }, ...COMPANY_SIZES]}
          defaultValue={str("companySize") ?? ""}
          error={fe.companySize}
          required
        />
      </div>

      <SelectField
        id="requestType"
        name="requestType"
        label="Type of request"
        options={[{ value: "", label: "Choose" }, ...ENTERPRISE_REQUEST_TYPES]}
        defaultValue={str("requestType") ?? ""}
        error={fe.requestType}
        required
      />

      <ChoiceGroup
        name="regions"
        type="checkbox"
        legend="Where your visitors or data are"
        hint="Choose all that apply. It decides which law and which data region apply."
        options={REGION_CHOICES}
        defaultValue={regions}
        error={fe.regions}
        required
      />

      <TextAreaField
        id="message"
        name="message"
        label="What do you need?"
        hint="For example: our DPA with your sub-processor list, signed before 30 November. Include deadlines and portal links if procurement runs through one."
        rows={5}
        required
        minLength={20}
        maxLength={MAX.message}
        defaultValue={str("message")}
        error={fe.message}
      />

      <FormMessage state={state?.error ? { error: state.error } : null} />
      <SubmitButton className="w-full" pending="Sending request">
        Submit an enterprise request
      </SubmitButton>
      <PrivacyNote />
    </form>
  );
}
