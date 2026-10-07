"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import {
  changePassword,
  confirmMfaEnrolment,
  newRecoveryCodes,
  revokeSession,
  signOutOtherSessions,
  startMfaEnrolment,
  turnOffMfa,
  type EnrolState,
  type RecoveryState,
} from "@/app/app/account/actions";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { CopyButton } from "@/components/app/ui/copy-button";
import { TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function CodeField({ id, error, label = "Code from your app" }: { id: string; error?: string[]; label?: string }) {
  return (
    <TextField
      id={id}
      name="code"
      label={label}
      inputMode="text"
      autoComplete="one-time-code"
      maxLength={20}
      spellCheck={false}
      placeholder="123456"
      className="[&_input]:font-mono [&_input]:tracking-[0.2em]"
      error={error}
    />
  );
}

/** Recovery codes, shown once. Copy or download them; they're stored only as hashes. */
function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(`Plain Theory recovery codes\nEach code works once.\n\n${text}\n`)}`;
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-amber-bright bg-amber-wash p-4">
      <p className="text-sm font-semibold text-amber">Save these recovery codes now. They won&apos;t be shown again.</p>
      <p className="mt-1 text-sm text-ink-2">Each one signs you in once if you lose your phone. Store them in your password manager.</p>
      <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-ink" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton value={text} label="Copy codes" />
        <a href={href} download="plain-theory-recovery-codes.txt" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-ink-2 hover:bg-paper hover:text-ink">
          Download .txt
        </a>
      </div>
    </div>
  );
}

/* ---------------- two-factor ---------------- */

export function MfaSection({ enabled, enabledAt, recoveryLeft, required, orgRequiring }: { enabled: boolean; enabledAt?: string; recoveryLeft: number; required: boolean; orgRequiring?: string }) {
  return (
    <SettingsSection
      title="Two-factor sign-in"
      description="After your password, you'll enter a 6-digit code from an authenticator app such as 1Password, Google Authenticator or Authy."
    >
      {required && !enabled ? (
        <div role="alert" className="my-4 rounded-md bg-amber-wash px-4 py-3 text-sm text-amber">
          <strong className="font-semibold">{orgRequiring ?? "Your organization"} requires two-factor sign-in.</strong> Set it up below to keep using Plain Theory.
        </div>
      ) : null}
      {enabled ? <MfaOn enabledAt={enabledAt!} recoveryLeft={recoveryLeft} locked={Boolean(orgRequiring)} orgRequiring={orgRequiring} /> : <MfaEnrol />}
    </SettingsSection>
  );
}

function MfaEnrol() {
  const [setup, setSetup] = useState<EnrolState>(null);
  const [pending, start] = useTransition();
  const [state, action] = useActionState<EnrolState, FormData>(confirmMfaEnrolment, null);

  if (state?.recoveryCodes) {
    return (
      <div className="space-y-4 py-5">
        <FormMessage state={{ ok: state.ok }} />
        <RecoveryCodes codes={state.recoveryCodes} />
      </div>
    );
  }
  if (!setup?.secret) {
    return (
      <SettingsRow label="Status" description="Two-factor isn't on for your account.">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="held">Off</Badge>
          <Button loading={pending} loadingLabel="Preparing" onClick={() => start(async () => setSetup(await startMfaEnrolment()))}>
            Set up two-factor
          </Button>
        </div>
        {setup?.error ? <div className="mt-3"><FormMessage state={setup} /></div> : null}
      </SettingsRow>
    );
  }
  const grouped = setup.secret.match(/.{1,4}/g)!.join(" ");
  return (
    <>
      <SettingsRow label="1. Add Plain Theory to your app" description="On your phone, tap the link, or add an account in your authenticator and type the key. The key expires in 15 minutes.">
        <div className="space-y-3">
          <div>
            <p className="label" id="mfa-key-label">Setup key</p>
            <p aria-labelledby="mfa-key-label" className="select-all break-all rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-base tracking-wider text-ink">
              {grouped}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={setup.secret} label="Copy key" />
            <a href={setup.uri} className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-brand-ink hover:bg-paper">
              Open in authenticator app
            </a>
          </div>
          <p className="text-xs text-ink-3">Type: time-based (TOTP) · 6 digits · 30 seconds · SHA-1</p>
        </div>
      </SettingsRow>
      <SettingsRow label="2. Confirm" description="Enter the code your app shows now.">
        <form action={action} className="space-y-3" noValidate>
          <CodeField id="mfa-confirm" error={state?.fieldErrors?.code} />
          {state?.error && !state.fieldErrors ? <FormMessage state={state} /> : null}
          <SubmitButton pending="Checking">Turn on two-factor</SubmitButton>
        </form>
      </SettingsRow>
    </>
  );
}

function MfaOn({ enabledAt, recoveryLeft, locked, orgRequiring }: { enabledAt: string; recoveryLeft: number; locked: boolean; orgRequiring?: string }) {
  const [codes, regen] = useActionState<RecoveryState, FormData>(newRecoveryCodes, null);
  const [off, disable] = useActionState<ActionResult, FormData>(turnOffMfa, null);
  return (
    <>
      <SettingsRow label="Status" description={`On since ${when(enabledAt)}.`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="released">On</Badge>
          <Badge tone={recoveryLeft <= 2 ? "held" : "neutral"}>
            {recoveryLeft} recovery code{recoveryLeft === 1 ? "" : "s"} left
          </Badge>
        </div>
      </SettingsRow>
      <SettingsRow label="Recovery codes" description="Make a new set if you've used some or think they've been seen. The old set stops working.">
        {codes?.recoveryCodes ? (
          <RecoveryCodes codes={codes.recoveryCodes} />
        ) : (
          <form action={regen} className="space-y-3" noValidate>
            <CodeField id="mfa-regen" error={codes?.fieldErrors?.code} />
            {codes?.error && !codes.fieldErrors ? <FormMessage state={codes} /> : null}
            <SubmitButton variant="ghost" pending="Creating">
              Create new recovery codes
            </SubmitButton>
          </form>
        )}
      </SettingsRow>
      <SettingsRow label="Turn off" description={locked ? `${orgRequiring} requires two-factor, so it stays on.` : "You'll sign in with your password only."}>
        {locked ? (
          <p className="text-sm text-ink-3">Ask an owner if you need this changed.</p>
        ) : off?.ok ? (
          <FormMessage state={off} />
        ) : (
          <form action={disable} className="space-y-3" noValidate>
            <CodeField id="mfa-off" label="Code or recovery code" error={off?.fieldErrors?.code} />
            {off?.error && !off.fieldErrors ? <FormMessage state={off} /> : null}
            <SubmitButton variant="danger" pending="Turning off">
              Turn off two-factor
            </SubmitButton>
          </form>
        )}
      </SettingsRow>
    </>
  );
}

/* ---------------- sessions ---------------- */

export interface SessionRow {
  id: string;
  current: boolean;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  mfaVerified: boolean;
}

/** Sessions listed before "Show all" (this browser is always among them). */
const SESSIONS_SHOWN = 5;

export function SessionsSection({ sessions }: { sessions: SessionRow[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  // this browser first, then most recently active
  const ordered = [...sessions].sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt.localeCompare(a.lastSeenAt));
  const visible = showAll ? ordered : ordered.slice(0, SESSIONS_SHOWN);
  const hidden = ordered.length - SESSIONS_SHOWN;
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) toast(r.ok);
    });
  const others = sessions.filter((s) => !s.current).length;
  return (
    <SettingsSection
      title="Where you're signed in"
      description="Sessions end after 30 minutes without activity and 12 hours after sign-in, whichever comes first."
      footer={
        others ? (
          <Button variant="ghost" disabled={pending} onClick={() => run(signOutOtherSessions)}>
            Sign out everywhere else
          </Button>
        ) : null
      }
    >
      <ul id={listId} className="divide-y divide-line">
        {visible.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {s.device}
                {s.current ? <Badge tone="brand">This browser</Badge> : null}
                {s.mfaVerified ? <Badge tone="neutral">Two-factor</Badge> : null}
              </p>
              <p className="mt-0.5 text-xs text-ink-3">
                Signed in {when(s.createdAt)} · last active {when(s.lastSeenAt)} · ends by {when(s.expiresAt)}
              </p>
            </div>
            {s.current ? null : (
              <Button variant="quiet" size="sm" className="max-sm:min-w-11" disabled={pending} onClick={() => run(() => revokeSession(s.id))}>
                Sign out<span className="sr-only"> {s.device} session, last active {when(s.lastSeenAt)}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <div className="border-t border-line pt-3">
          <Button variant="quiet" size="sm" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer sessions" : `Show all ${ordered.length} sessions`}
          </Button>
        </div>
      ) : null}
    </SettingsSection>
  );
}

/* ---------------- password ---------------- */

export function PasswordSection({ mfa, changedAt, hint }: { mfa: boolean; changedAt?: string; hint: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(changePassword, null);
  const toast = useToast();
  const fe = state?.fieldErrors;
  useEffect(() => {
    if (state?.ok) toast(state.ok);
  }, [state, toast]);
  return (
    <SettingsSection title="Password" description={`${changedAt ? `Last changed ${when(changedAt)}. ` : ""}Changing it signs out your other sessions.`}>
      <form key={state?.ok ?? "form"} action={action} className="py-5" noValidate>
        <div className="grid max-w-xl gap-4">
          <TextField id="pw-current" name="current" type="password" label="Current password" autoComplete="current-password" error={fe?.current} />
          <TextField
            id="pw-next"
            name="next"
            type="password"
            label="New password"
            autoComplete="new-password"
            hint={hint}
            error={fe?.next}
          />
          <TextField id="pw-confirm" name="confirm" type="password" label="Confirm new password" autoComplete="new-password" error={fe?.confirm} />
          {mfa ? <CodeField id="pw-code" error={fe?.code} /> : null}
          {state?.error && !fe ? <FormMessage state={state} /> : null}
          <div>
            <SubmitButton pending="Changing" variant="ghost">
              Change password
            </SubmitButton>
          </div>
        </div>
      </form>
    </SettingsSection>
  );
}
