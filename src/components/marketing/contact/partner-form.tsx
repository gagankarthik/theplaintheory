"use client";

import { useActionState, useRef } from "react";
import { requestPartner, type RequestState } from "@/app/(marketing)/contact/actions";
import { SelectField, TextAreaField, TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage } from "@/components/app/ui/toast";
import { PARTNERSHIP_TYPES, PARTNER_QUERY_TYPES } from "@/lib/lead-options";
import { ChoiceGroup, Optional, PrivacyNote, RequestSuccess } from "./request-ui";

/** Mirrors partnerSchema in lib/leads.ts (the server is the source of truth). */
const MAX = { name: 120, company: 160, email: 254, domain: 253, message: 2000 };

export function PartnerForm({ formToken }: { formToken: string }) {
  const [state, action] = useActionState<RequestState, FormData>(requestPartner, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  const v = state?.values ?? {};
  const fe = state?.fieldErrors ?? {};
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);

  if (state?.ok) {
    return (
      <RequestSuccess
        message={state.ok}
        reference={state.reference}
        email={state.email}
        next={[
          "Your request goes to the partnerships team for your programme.",
          "We reply by email with an answer, or with the next steps for your account or campaign.",
          "Payout and account changes are confirmed in writing before they take effect.",
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
        <TextField
          id="website"
          name="website"
          label={
            <>
              Website
              <Optional />
            </>
          }
          placeholder="agency.com"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={MAX.domain}
          defaultValue={str("website")}
          error={fe.website}
        />
      </div>

      <ChoiceGroup name="partnershipType" legend="Partnership type" options={PARTNERSHIP_TYPES} defaultValue={str("partnershipType")} error={fe.partnershipType} required />

      <SelectField
        id="queryType"
        name="queryType"
        label="What is your query about?"
        options={[{ value: "", label: "Choose" }, ...PARTNER_QUERY_TYPES]}
        defaultValue={str("queryType") ?? ""}
        error={fe.queryType}
        required
      />

      <TextAreaField
        id="message"
        name="message"
        label="Message"
        hint="Include your partner ID or campaign name if you have one."
        rows={5}
        required
        minLength={20}
        maxLength={MAX.message}
        defaultValue={str("message")}
        error={fe.message}
      />

      <FormMessage state={state?.error ? { error: state.error } : null} />
      <SubmitButton className="w-full" pending="Sending request">
        Submit request
      </SubmitButton>
      <PrivacyNote />
    </form>
  );
}
