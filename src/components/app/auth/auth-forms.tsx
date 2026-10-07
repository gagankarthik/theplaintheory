"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { cancelLoginCode, login, signup, verifyLoginCode, type AuthState } from "@/app/(auth)/actions";
import { IconEye } from "@/components/icons";
import { FormMessage } from "@/components/app/ui/toast";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";

function PasswordField({
  autoComplete,
  hint,
  error,
  minLength,
  maxLength,
}: {
  autoComplete: string;
  hint?: string;
  error?: string[];
  minLength?: number;
  maxLength: number;
}) {
  const [show, setShow] = useState(false);
  const err = error?.[0];
  const describedBy = [hint ? "password-hint" : null, err ? "password-error" : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor="password" className="label">
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={err ? true : undefined}
          aria-describedby={describedBy}
          className={`field pr-12 ${err ? "!border-rose focus:!shadow-[0_0_0_4px_var(--color-rose-wash)]" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-ink-3 hover:text-ink"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          <IconEye size={18} />
        </button>
      </div>
      {hint ? (
        <p id="password-hint" className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {err ? (
        <p id="password-error" className="mt-1.5 text-xs font-bold text-rose">
          {err}
        </p>
      ) : null}
    </div>
  );
}

/** Shared attributes for email inputs; maxLength mirrors emailSchema in lib/validation.ts. */
const EMAIL_INPUT = { type: "email", inputMode: "email", autoCapitalize: "none", spellCheck: false, maxLength: 254, required: true } as const;

/** Summary only when it's not already shown next to a field. */
const summary = (s: AuthState) => (s && !s.fieldErrors ? s : null);

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(login, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
      <FormGuard />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField id="email" label="Work email" autoComplete="username" {...EMAIL_INPUT} defaultValue={state?.email} error={state?.fieldErrors?.email} />
      <PasswordField autoComplete="current-password" maxLength={256} error={state?.fieldErrors?.password} />
      <FormMessage state={summary(state)} />
      <SubmitButton className="w-full" pending="Signing in">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-ink-3">
        New here?{" "}
        <Link href="/signup" className="font-bold text-brand underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ formToken, plan }: { formToken: string; plan?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signup, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
      <FormGuard token={state?.formToken ?? formToken} />
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      <TextField
        id="name"
        label="Your name"
        required
        minLength={2}
        maxLength={100}
        autoComplete="name"
        defaultValue={state?.name}
        error={state?.fieldErrors?.name}
      />
      <TextField id="email" label="Work email" autoComplete="email" {...EMAIL_INPUT} defaultValue={state?.email} error={state?.fieldErrors?.email} />
      <PasswordField
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        hint="At least 12 characters. Avoid common passwords and your email name."
        error={state?.fieldErrors?.password}
      />
      <FormMessage state={summary(state)} />
      <SubmitButton className="w-full" pending="Creating account">
        Create account
      </SubmitButton>
      <p className="text-xs leading-relaxed text-ink-3">
        By creating an account you agree to the{" "}
        <Link href="/legal/terms" className="underline underline-offset-2 hover:text-ink">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-ink">
          privacy notice
        </Link>
        .
      </p>
      <p className="text-center text-sm text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Second sign-in step: a code from the authenticator app, or a single-use recovery code. */
export function VerifyCodeForm() {
  const [state, action] = useActionState<AuthState, FormData>(verifyLoginCode, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <div className="space-y-5 short:space-y-4 shorter:space-y-3">
      <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
        <FormGuard />
        <TextField
          id="code"
          name="code"
          label="Verification code"
          hint="The 6-digit code from your authenticator app, or one of your recovery codes."
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          required
          minLength={6}
          maxLength={20}
          autoCapitalize="none"
          spellCheck={false}
          className="[&_input]:font-mono [&_input]:tracking-[0.2em]"
          error={state?.fieldErrors?.code}
        />
        <FormMessage state={state && !state.fieldErrors ? state : null} />
        <SubmitButton className="w-full" pending="Checking">
          Verify and sign in
        </SubmitButton>
      </form>
      <form action={cancelLoginCode}>
        <button type="submit" className="w-full text-center text-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          Use a different account
        </button>
      </form>
    </div>
  );
}
