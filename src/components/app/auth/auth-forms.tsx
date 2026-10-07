"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelLoginCode,
  login,
  requestPasswordReset,
  resetPassword,
  restartReset,
  restartSignup,
  signup,
  verifyLoginCode,
  verifySignup,
  type AuthState,
} from "@/app/(auth)/actions";
import { IconEye } from "@/components/icons";
import { Button } from "@/components/app/ui/button";
import { FormMessage } from "@/components/app/ui/toast";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";

export function PasswordField({
  id = "password",
  label = "Password",
  autoComplete,
  hint,
  error,
  minLength,
  maxLength,
}: {
  id?: string;
  label?: string;
  autoComplete: string;
  hint?: string;
  error?: string[];
  minLength?: number;
  maxLength: number;
}) {
  const [show, setShow] = useState(false);
  const err = error?.[0];
  const describedBy = [hint ? `${id}-hint` : null, err ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
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
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {err ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-rose">
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

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(login, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
      <FormGuard />
      <input type="hidden" name="next" value={next ?? ""} />
      {/* A confirmation from the step before (password reset, e-mail confirmed), until they submit */}
      {!state && notice ? <FormMessage state={{ ok: notice }} /> : null}
      <TextField id="email" label="Work email" autoComplete="username" {...EMAIL_INPUT} defaultValue={state?.email} error={state?.fieldErrors?.email} />
      <div>
        <PasswordField autoComplete="current-password" maxLength={256} error={state?.fieldErrors?.password} />
        <div className="-mb-2 flex justify-end">
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
      <FormMessage state={summary(state)} />
      <SubmitButton className="w-full" pending="Signing in">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-ink-3">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ formToken, plan, passwordHint, email }: { formToken: string; plan?: string; passwordHint: string; email?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signup, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
      <FormGuard token={state?.formToken ?? formToken} />
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {/* Side by side from tablet width up; stacked on phones */}
      <div className="grid gap-5 sm:grid-cols-2 short:gap-4 shorter:gap-3">
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
        <TextField id="email" label="Work email" autoComplete="email" {...EMAIL_INPUT} defaultValue={state?.email ?? email} error={state?.fieldErrors?.email} />
      </div>
      <PasswordField
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        hint={passwordHint}
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
        <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
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

/* ---------------- e-mailed codes: confirm sign-up, reset password ---------------- */

/** Ticks once a second while `until` is in the future; returns whole seconds left (0 when ready). */
function useSecondsUntil(until: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const tick = () => setNow(Date.now());
    tick();
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      tick();
      if (Date.now() >= until) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

/**
 * A submit button for one `intent` of a form that has two (confirm, or send a new code). Only the
 * button that was pressed shows the spinner; both are disabled while either request runs.
 */
function IntentButton({
  intent,
  pendingLabel,
  variant = "primary",
  className,
  disabled,
  children,
}: {
  intent: "submit" | "resend";
  pendingLabel: string;
  variant?: "primary" | "ghost";
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (data?.get("intent") ?? "submit") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      className={className}
      formNoValidate={intent === "resend"}
      disabled={disabled || (pending && !mine)}
      loading={mine}
      loadingLabel={pendingLabel}
    >
      {children}
    </Button>
  );
}

function ResendButton({ resendAt }: { resendAt?: number }) {
  const wait = useSecondsUntil(resendAt);
  return (
    <IntentButton intent="resend" variant="ghost" className="w-full" pendingLabel="Sending" disabled={wait > 0}>
      {wait > 0 ? (
        <>
          Send a new code in {wait}
          <span aria-hidden="true">s</span>
          <span className="sr-only"> seconds</span>
        </>
      ) : (
        "Send a new code"
      )}
    </IntentButton>
  );
}

const CODE_INPUT = {
  inputMode: "numeric",
  autoComplete: "one-time-code",
  maxLength: 7,
  autoCapitalize: "none",
  spellCheck: false,
  required: true,
  controlClassName: "font-mono text-lg tracking-[0.35em]",
} as const;

/** Where the code went: nothing to ask when we know the address, an email field when we don't. */
function CodeRecipient({ maskedEmail, state }: { maskedEmail?: string; state: AuthState }) {
  if (maskedEmail) return null;
  return <TextField id="email" label="Work email" autoComplete="username" {...EMAIL_INPUT} defaultValue={state?.email} error={state?.fieldErrors?.email} />;
}

/** Confirm a new account with the 6-digit code Cognito e-mailed. */
export function SignupVerifyForm({ maskedEmail, resendAt }: { maskedEmail?: string; resendAt?: number }) {
  const [state, action] = useActionState<AuthState, FormData>(verifySignup, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <div className="space-y-5 short:space-y-4 shorter:space-y-3">
      <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
        <FormGuard />
        <CodeRecipient maskedEmail={maskedEmail} state={state} />
        <TextField
          id="code"
          label="Confirmation code"
          hint="6 digits. Only the newest code works."
          autoFocus={Boolean(maskedEmail)}
          {...CODE_INPUT}
          error={state?.fieldErrors?.code}
        />
        <FormMessage state={summary(state)} />
        <IntentButton intent="submit" className="w-full" pendingLabel="Confirming">
          Confirm email
        </IntentButton>
        <ResendButton resendAt={state?.resendAt ?? resendAt} />
      </form>
      <form action={restartSignup}>
        <button type="submit" className="flex min-h-11 w-full items-center justify-center text-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          Use a different email
        </button>
      </form>
    </div>
  );
}

/** Step one of a reset: where to send the code. The same answer whether or not the address has an account. */
export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
      <FormGuard />
      <TextField id="email" label="Work email" autoComplete="username" autoFocus {...EMAIL_INPUT} defaultValue={state?.email} error={state?.fieldErrors?.email} />
      <FormMessage state={summary(state)} />
      <SubmitButton className="w-full" pending="Sending code">
        Send reset code
      </SubmitButton>
      <p className="text-center text-sm text-ink-3">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/** Step two: the e-mailed code and a new password. */
export function ResetPasswordForm({ maskedEmail, resendAt, passwordHint }: { maskedEmail?: string; resendAt?: number; passwordHint: string }) {
  const [state, action] = useActionState<AuthState, FormData>(resetPassword, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <div className="space-y-5 short:space-y-4 shorter:space-y-3">
      <form ref={formRef} action={action} className="space-y-5 short:space-y-4 shorter:space-y-3" noValidate>
        <FormGuard />
        <CodeRecipient maskedEmail={maskedEmail} state={state} />
        <TextField id="code" label="Reset code" hint="6 digits, from the email we sent. Only the newest code works." autoFocus={Boolean(maskedEmail)} {...CODE_INPUT} error={state?.fieldErrors?.code} />
        <PasswordField id="password" label="New password" autoComplete="new-password" minLength={12} maxLength={128} hint={passwordHint} error={state?.fieldErrors?.password} />
        <TextField
          id="confirm"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          required
          maxLength={128}
          autoCapitalize="none"
          spellCheck={false}
          error={state?.fieldErrors?.confirm}
        />
        <FormMessage state={summary(state)} />
        <IntentButton intent="submit" className="w-full" pendingLabel="Saving">
          Set new password
        </IntentButton>
        <ResendButton resendAt={state?.resendAt ?? resendAt} />
      </form>
      <form action={restartReset}>
        <button type="submit" className="flex min-h-11 w-full items-center justify-center text-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          Use a different email
        </button>
      </form>
    </div>
  );
}
