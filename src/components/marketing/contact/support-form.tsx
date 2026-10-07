"use client";

import { useActionState, useRef } from "react";
import { requestSupport, type RequestState } from "@/app/(marketing)/contact/actions";
import { SelectField, TextAreaField, TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage } from "@/components/app/ui/toast";
import { SUPPORT_CATEGORIES, SUPPORT_SEVERITIES } from "@/lib/lead-options";
import { ChoiceGroup, Optional, PrivacyNote, RequestSuccess } from "./request-ui";

/** Mirrors supportSchema in lib/leads.ts (the server is the source of truth). */
const MAX = { name: 120, email: 254, domain: 253, subject: 160, message: 2000 };

export function SupportForm({ formToken }: { formToken: string }) {
  const [state, action] = useActionState<RequestState, FormData>(requestSupport, null);
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
          "A support engineer reads your ticket and checks your site's setup.",
          "We reply by email with a fix, or with questions if we need more detail.",
          "Reply to that email to add screenshots or more information.",
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
          label="Email"
          hint="Use the address you sign in with, so we can find your account."
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
        <TextField
          id="siteDomain"
          name="siteDomain"
          label={
            <>
              Site domain
              <Optional />
            </>
          }
          placeholder="example.com"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={MAX.domain}
          defaultValue={str("siteDomain")}
          error={fe.siteDomain}
        />
        <SelectField
          id="category"
          name="category"
          label="What is it about?"
          options={[{ value: "", label: "Choose" }, ...SUPPORT_CATEGORIES]}
          defaultValue={str("category") ?? ""}
          error={fe.category}
          required
        />
      </div>

      <ChoiceGroup name="severity" legend="How much does this affect you?" options={SUPPORT_SEVERITIES} defaultValue={str("severity")} error={fe.severity} required />

      <TextField
        id="subject"
        name="subject"
        label="Subject"
        placeholder="Banner doesn't show on checkout pages"
        required
        minLength={4}
        maxLength={MAX.subject}
        defaultValue={str("subject")}
        error={fe.subject}
      />

      <TextAreaField
        id="message"
        name="message"
        label="Description"
        hint="What happened, what you expected, and the page where you saw it. Include any error message."
        rows={6}
        required
        minLength={20}
        maxLength={MAX.message}
        defaultValue={str("message")}
        error={fe.message}
      />

      <FormMessage state={state?.error ? { error: state.error } : null} />
      <SubmitButton className="w-full" pending="Sending ticket">
        Raise a ticket
      </SubmitButton>
      <PrivacyNote />
    </form>
  );
}
