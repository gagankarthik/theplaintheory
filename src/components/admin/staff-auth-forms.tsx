"use client";

import { useActionState, useRef } from "react";
import { cancelStaffLogin, staffConfirmMfaSetup, staffLogin, staffNewPassword, staffVerifyMfa, type StaffAuthState } from "@/app/admin/login/actions";
import { PasswordField } from "@/components/app/auth/auth-forms";
import { Checkbox } from "@/components/app/ui/checkbox";
import { CopyButton } from "@/components/app/ui/copy-button";
import { TextField } from "@/components/app/ui/field";
import { FormGuard, useFocusOnError } from "@/components/app/ui/form-guard";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage } from "@/components/app/ui/toast";
import { TotpQr } from "@/components/app/ui/totp-qr";

/** Summary only when it's not already shown next to a field. */
const summary = (s: StaffAuthState) => (s && !s.fieldErrors ? s : null);

const STACK = "space-y-5 short:space-y-4 shorter:space-y-3";

function StartOver() {
  return (
    <form action={cancelStaffLogin}>
      <button type="submit" className="flex min-h-11 w-full items-center justify-center text-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline">
        Start again with a different account
      </button>
    </form>
  );
}

function CodeField({ state, hint }: { state: StaffAuthState; hint: string }) {
  return (
    <TextField
      id="code"
      label="Authenticator code"
      hint={hint}
      inputMode="numeric"
      pattern="[0-9 ]*"
      autoComplete="one-time-code"
      autoFocus
      required
      minLength={6}
      maxLength={7}
      autoCapitalize="none"
      spellCheck={false}
      controlClassName="font-mono text-lg tracking-[0.35em]"
      error={state?.fieldErrors?.code}
    />
  );
}

export function StaffLoginForm({ next, notice }: { next?: string; notice?: { ok?: string; error?: string } }) {
  const [state, action] = useActionState<StaffAuthState, FormData>(staffLogin, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <form ref={formRef} action={action} className={STACK} noValidate>
      <FormGuard />
      <input type="hidden" name="next" value={next ?? ""} />
      {!state && notice ? <FormMessage state={notice} /> : null}
      <TextField
        id="email"
        label="Staff email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        required
        defaultValue={state?.email}
        error={state?.fieldErrors?.email}
      />
      <PasswordField autoComplete="current-password" maxLength={256} error={state?.fieldErrors?.password} />
      <FormMessage state={summary(state)} />
      <SubmitButton className="w-full" pending="Signing in">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-ink-3">Forgot your password or lost your authenticator? Ask a superadmin to reset your account.</p>
    </form>
  );
}

export function StaffNewPasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState<StaffAuthState, FormData>(staffNewPassword, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <div className={STACK}>
      <form ref={formRef} action={action} className={STACK} noValidate>
        {/* lets password managers save the new password against the right account */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          hint="At least 12 characters, with a lowercase letter, a number and a symbol. Avoid common passwords and your email name."
          error={state?.fieldErrors?.password}
        />
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
        <SubmitButton className="w-full" pending="Saving">
          Set password and continue
        </SubmitButton>
      </form>
      <StartOver />
    </div>
  );
}

export function StaffMfaSetupForm({ secret, uri }: { secret: string; uri: string }) {
  const [state, action] = useActionState<StaffAuthState, FormData>(staffConfirmMfaSetup, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <div className={STACK}>
      <section aria-labelledby="mfa-step-1" className="rounded-lg border border-line bg-paper p-4 sm:p-5">
        <h2 id="mfa-step-1" className="text-sm font-semibold">
          1. Scan this QR code with your authenticator app
        </h2>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          <TotpQr uri={uri} label="QR code to add Plain Theory Staff to your authenticator app" />
          <p className="text-sm text-ink-3">
            In 1Password, Google Authenticator, Microsoft Authenticator or Authy, add an account and scan the code. Can&apos;t scan? Type the setup key below, or on your phone open
            &ldquo;Open in authenticator app&rdquo;.
          </p>
        </div>
        <p className="label mt-4" id="mfa-key-label">
          Setup key
        </p>
        <p aria-labelledby="mfa-key-label" className="select-all break-all rounded-md border border-line bg-surface px-3 py-2.5 font-mono text-base tracking-wider text-ink">
          {grouped}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton value={secret} label="Copy key" />
          <a href={uri} className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-brand-ink hover:bg-surface">
            Open in authenticator app
          </a>
        </div>
        <p className="mt-3 text-xs text-ink-3">Type: time-based (TOTP) · 6 digits · 30 seconds · SHA-1</p>
      </section>
      <form ref={formRef} action={action} className={STACK} noValidate>
        <h2 className="text-sm font-semibold">2. Enter the code your app shows now</h2>
        <CodeField state={state} hint="6 digits. You'll need a code from this app every time you sign in to the console." />
        <FormMessage state={summary(state)} />
        <SubmitButton className="w-full" pending="Checking">
          Turn on and sign in
        </SubmitButton>
      </form>
      <StartOver />
    </div>
  );
}

/** `canTrust`: offer "Trust this browser for 30 days" (STAFF_REMEMBER_DEVICE=1 only). */
export function StaffVerifyForm({ canTrust = false }: { canTrust?: boolean }) {
  const [state, action] = useActionState<StaffAuthState, FormData>(staffVerifyMfa, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(state, formRef);
  return (
    <div className={STACK}>
      <form ref={formRef} action={action} className={STACK} noValidate>
        <CodeField state={state} hint="The 6-digit code from the authenticator app you set up for the staff console." />
        {canTrust ? (
          <Checkbox
            id="trust"
            name="trust"
            label="Trust this browser for 30 days"
            description="You won't need a code to sign in here until then. Your password is still required. Don't tick this on a shared or public computer."
          />
        ) : null}
        <FormMessage state={summary(state)} />
        <SubmitButton className="w-full" pending="Checking">
          Verify and sign in
        </SubmitButton>
      </form>
      <StartOver />
    </div>
  );
}
