"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  changePassword,
  confirmMfaEnrolment,
  finishPasskeyRegistration,
  newRecoveryCodes,
  removeAuthenticatorApp,
  removePasskey,
  revokeSession,
  signOutOtherSessions,
  skipMfaSetup,
  startMfaEnrolment,
  startPasskeyCheck,
  startPasskeyRegistration,
  type EnrolState,
  type PasskeyAddState,
  type RecoveryState,
} from "@/app/app/account/actions";
import { passkeyErrorMessage, useWebAuthnSupport } from "@/components/app/auth/passkey-client";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { CopyButton } from "@/components/app/ui/copy-button";
import { Dialog } from "@/components/app/ui/dialog";
import { TextField } from "@/components/app/ui/field";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
import { IconCheck } from "@/components/icons";
import type { ActionResult } from "@/lib/action-result";
import { TotpQr } from "@/components/app/ui/totp-qr";

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
      <p className="mt-1 text-sm text-ink-2">Each one signs you in once if you lose your phone or passkey. Store them in your password manager.</p>
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

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type CodesShown = { ok?: string; codes: string[] };

export interface PasskeyRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface MfaRequirementInfo {
  orgName: string;
  /** "required": blocked now (Skip may still be offered); "deferred": skipped, inside the grace period */
  state: "required" | "deferred";
  /** end of the grace period, ISO */
  deadline: string;
  canSkip: boolean;
}

/**
 * A fresh second-factor check inside a sensitive form: "Confirm with a passkey" (puts the signed
 * assertion in a hidden field), or a code from the authenticator app or a recovery code.
 */
function SecondFactorProof({ id, totp, passkeys, error }: { id: string; totp: boolean; passkeys: boolean; error?: string[] }) {
  const supported = useWebAuthnSupport();
  const [assertion, setAssertion] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hidden = useRef<HTMLInputElement>(null);

  // A passkey check is single use: once the form is sent, the next try needs a new one.
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setTimeout(() => setAssertion(null));
    form.addEventListener("submit", reset);
    return () => form.removeEventListener("submit", reset);
  }, []);

  const confirm = () =>
    start(async () => {
      setProblem(null);
      const o = await startPasskeyCheck();
      if (!o.ok) return setProblem(o.error);
      try {
        setAssertion(JSON.stringify(await startAuthentication({ optionsJSON: o.options })));
      } catch (e) {
        setProblem(passkeyErrorMessage(e, "get"));
      }
    });

  const usePasskey = passkeys && supported === true;
  return (
    <div className="space-y-3">
      <input ref={hidden} type="hidden" name="assertion" value={assertion ?? ""} />
      {assertion ? (
        <p role="status" className="flex items-center gap-2 text-sm text-jade">
          <IconCheck size={16} aria-hidden /> Confirmed with your passkey.
        </p>
      ) : (
        <>
          {usePasskey ? (
            <div className="space-y-2">
              <Button variant="ghost" loading={pending} loadingLabel="Waiting for your passkey" onClick={confirm}>
                Confirm with a passkey
              </Button>
              {problem ? (
                <p role="alert" className="text-xs font-semibold text-rose">
                  {problem}
                </p>
              ) : null}
              <p className="text-xs text-ink-3">Or enter a code:</p>
            </div>
          ) : null}
          <CodeField id={id} label={totp ? "Code from your app, or a recovery code" : "Recovery code"} error={error} />
        </>
      )}
    </div>
  );
}

export function MfaSection({
  enabled,
  enabledAt,
  recoveryLeft,
  totp,
  passkeys,
  requirement,
  orgRequiring,
  defaultPasskeyName,
}: {
  enabled: boolean;
  enabledAt?: string;
  recoveryLeft: number;
  totp: boolean;
  passkeys: PasskeyRow[];
  /** set when an organization requires two-factor and this member hasn't set it up */
  requirement: MfaRequirementInfo | null;
  /** an organization that requires two-factor (blocks removing the last method) */
  orgRequiring?: string;
  defaultPasskeyName: string;
}) {
  const [codes, setCodes] = useState<CodesShown | null>(null);
  const [totpEnrolling, setTotpEnrolling] = useState(false);
  const factors = (totp ? 1 : 0) + passkeys.length;
  const lastLocked = factors === 1 && Boolean(orgRequiring);
  return (
    <SettingsSection
      id="two-factor"
      title="Two-factor sign-in"
      description="After your password, confirm it's you with a passkey or a code from an authenticator app. Use either, or both."
    >
      {requirement && !enabled ? <RequirementNotice requirement={requirement} /> : null}
      {codes ? (
        <div className="space-y-4 py-5">
          <FormMessage state={{ ok: codes.ok }} />
          <RecoveryCodes codes={codes.codes} />
        </div>
      ) : null}
      {enabled ? (
        <SettingsRow label="Status" description={enabledAt ? `On since ${when(enabledAt)}.` : undefined}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="released">On</Badge>
            <Badge tone={recoveryLeft <= 2 ? "held" : "neutral"}>
              {recoveryLeft} recovery code{recoveryLeft === 1 ? "" : "s"} left
            </Badge>
          </div>
        </SettingsRow>
      ) : null}
      <PasskeysRow
        passkeys={passkeys}
        totp={totp}
        primary={!enabled && !totpEnrolling}
        defaultName={defaultPasskeyName}
        lastLocked={lastLocked}
        orgRequiring={orgRequiring}
        onCodes={setCodes}
      />
      <AuthenticatorRow totp={totp} passkeys={passkeys.length > 0} lastLocked={lastLocked} orgRequiring={orgRequiring} onEnrolling={setTotpEnrolling} onCodes={setCodes} />
      {enabled ? <RecoveryRow totp={totp} passkeys={passkeys.length > 0} /> : null}
    </SettingsSection>
  );
}

/** The org policy: set up now, or skip until the deadline. */
function RequirementNotice({ requirement }: { requirement: MfaRequirementInfo }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const due = day(requirement.deadline);
  if (requirement.state === "deferred") {
    return (
      <div className="my-4 rounded-md bg-amber-wash px-4 py-3 text-sm text-amber">
        <strong className="font-semibold">{requirement.orgName} requires two-factor sign-in.</strong> Set it up by {due} to keep using Plain Theory.
      </div>
    );
  }
  return (
    <div role="alert" className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-wash px-4 py-3 text-sm text-amber">
      <p>
        <strong className="font-semibold">{requirement.orgName} requires two-factor sign-in.</strong>{" "}
        {requirement.canSkip ? `Set it up below. You can skip until ${due}.` : "Set it up below to keep using Plain Theory."}
      </p>
      {requirement.canSkip ? (
        <Button
          variant="ghost"
          size="sm"
          loading={pending}
          loadingLabel="Skipping"
          onClick={() =>
            start(async () => {
              const r = await skipMfaSetup();
              if (r?.error) toast(r.error, "error");
            })
          }
        >
          Skip for now
        </Button>
      ) : null}
    </div>
  );
}

/* ---------- passkeys ---------- */

function PasskeysRow({
  passkeys,
  totp,
  primary,
  defaultName,
  lastLocked,
  orgRequiring,
  onCodes,
}: {
  passkeys: PasskeyRow[];
  totp: boolean;
  primary: boolean;
  defaultName: string;
  lastLocked: boolean;
  orgRequiring?: string;
  onCodes: (c: CodesShown) => void;
}) {
  const supported = useWebAuthnSupport();
  const toast = useToast();
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState<PasskeyAddState>(null);
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<PasskeyRow | null>(null);

  const add = () =>
    start(async () => {
      setState(null);
      const o = await startPasskeyRegistration(name);
      if (!o.ok) return setState({ error: o.error, fieldErrors: o.field ? { name: [o.error] } : undefined });
      let response;
      try {
        response = await startRegistration({ optionsJSON: o.options });
      } catch (e) {
        return setState({ error: passkeyErrorMessage(e, "create") });
      }
      const r = await finishPasskeyRegistration(response, name);
      if (r?.recoveryCodes) onCodes({ ok: r.ok, codes: r.recoveryCodes });
      else if (r?.ok) toast(r.ok);
      setState(r?.error ? r : null);
    });

  return (
    <SettingsRow
      label={
        <span className="inline-flex items-center gap-2">
          Passkey <Badge tone="neutral">Recommended</Badge>
        </span>
      }
      description="Face ID, Touch ID, Windows Hello or a security key. Nothing to type, and it can't be phished."
    >
      <div className="space-y-4">
        {passkeys.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Your passkeys">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Added {day(p.createdAt)} · {p.lastUsedAt ? `last used ${day(p.lastUsedAt)}` : "not used to sign in yet"}
                  </p>
                </div>
                <Button variant="danger-quiet" size="sm" onClick={() => setRemoving(p)}>
                  Remove<span className="sr-only"> passkey {p.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {supported === false ? (
          <p className="text-sm text-ink-3">This browser can&apos;t create passkeys. Use an authenticator app, or open Plain Theory in a browser that supports them.</p>
        ) : (
          <form
            className="space-y-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <TextField
              id="passkey-name"
              name="name"
              label="Passkey name"
              hint="So you can tell your passkeys apart later."
              maxLength={60}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={state?.fieldErrors?.name}
            />
            {state?.error && !state.fieldErrors ? <FormMessage state={state} /> : null}
            <Button type="submit" variant={primary ? "primary" : "ghost"} loading={pending} loadingLabel="Waiting for your device" disabled={supported === null}>
              {passkeys.length ? "Add another passkey" : "Add a passkey"}
            </Button>
          </form>
        )}
      </div>
      <RemoveFactorDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove “${removing.name}”?` : "Remove passkey"}
        action={removePasskey}
        hidden={removing ? { passkeyId: removing.id } : {}}
        confirmLabel="Remove passkey"
        totp={totp}
        passkeys={passkeys.length > 0}
        last={(totp ? 1 : 0) + passkeys.length === 1}
        lastLocked={lastLocked}
        orgRequiring={orgRequiring}
      />
    </SettingsRow>
  );
}

/** Confirm a removal with a fresh second-factor check. Blocked when it's the only method and an org requires one. */
function RemoveFactorDialog({
  open,
  onClose,
  title,
  action,
  hidden,
  confirmLabel,
  totp,
  passkeys,
  last,
  lastLocked,
  orgRequiring,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  action: (s: ActionResult, f: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  confirmLabel: string;
  totp: boolean;
  passkeys: boolean;
  last: boolean;
  lastLocked: boolean;
  orgRequiring?: string;
}) {
  const toast = useToast();
  const [state, run] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await action(prev, form);
    if (r?.ok) {
      toast(r.ok);
      onClose();
      return null;
    }
    return r;
  }, null);
  return (
    <Dialog open={open} onClose={onClose} title={title} description={lastLocked ? undefined : "Confirm it's you to remove it."}>
      {lastLocked ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            This is your only two-factor method, and {orgRequiring} requires two-factor. Add another passkey or an authenticator app first, then remove this one.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form action={run} className="space-y-4" noValidate>
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {last ? (
            <p className="rounded-md bg-rose-wash px-3 py-2.5 text-sm text-rose">
              This is your only two-factor method. Removing it turns two-factor off, and your recovery codes stop working.
            </p>
          ) : null}
          <SecondFactorProof id="remove-proof" totp={totp} passkeys={passkeys} error={state?.fieldErrors?.code} />
          {state?.error && !state.fieldErrors ? <FormMessage state={state} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton variant="danger" pending="Removing">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* ---------- authenticator app ---------- */

function AuthenticatorRow({
  totp,
  passkeys,
  lastLocked,
  orgRequiring,
  onEnrolling,
  onCodes,
}: {
  totp: boolean;
  passkeys: boolean;
  lastLocked: boolean;
  orgRequiring?: string;
  onEnrolling: (v: boolean) => void;
  onCodes: (c: CodesShown) => void;
}) {
  const [removing, setRemoving] = useState(false);
  return (
    <SettingsRow label="Authenticator app" description="A 6-digit code from 1Password, Google Authenticator, Authy or similar.">
      {totp ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="released">Set up</Badge>
          <Button variant="danger-quiet" size="sm" onClick={() => setRemoving(true)}>
            Remove<span className="sr-only"> authenticator app</span>
          </Button>
          <RemoveFactorDialog
            open={removing}
            onClose={() => setRemoving(false)}
            title="Remove your authenticator app?"
            action={removeAuthenticatorApp}
            hidden={{}}
            confirmLabel="Remove app"
            totp
            passkeys={passkeys}
            last={!passkeys}
            lastLocked={lastLocked}
            orgRequiring={orgRequiring}
          />
        </div>
      ) : (
        <TotpEnrol onEnrolling={onEnrolling} onCodes={onCodes} />
      )}
    </SettingsRow>
  );
}

function TotpEnrol({ onEnrolling, onCodes }: { onEnrolling: (v: boolean) => void; onCodes: (c: CodesShown) => void }) {
  const toast = useToast();
  const [setup, setSetup] = useState<EnrolState>(null);
  const [pending, start] = useTransition();
  const [state, action] = useActionState<EnrolState, FormData>(async (prev, form) => {
    const r = await confirmMfaEnrolment(prev, form);
    if (r?.ok) {
      if (r.recoveryCodes) onCodes({ ok: r.ok, codes: r.recoveryCodes });
      else toast(r.ok);
      onEnrolling(false);
      setSetup(null);
    }
    return r;
  }, null);

  if (!setup?.secret) {
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          loading={pending}
          loadingLabel="Preparing"
          onClick={() =>
            start(async () => {
              const r = await startMfaEnrolment();
              setSetup(r);
              if (r?.secret) onEnrolling(true);
            })
          }
        >
          Set up authenticator app
        </Button>
        {setup?.error ? <FormMessage state={setup} /> : null}
      </div>
    );
  }
  const grouped = setup.secret.match(/.{1,4}/g)!.join(" ");
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">1. Scan this QR code with your authenticator app</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <TotpQr uri={setup.uri!} />
          <p className="text-sm text-ink-3">
            In 1Password, Google Authenticator, Microsoft Authenticator or Authy, add an account and scan the code. Can&apos;t scan? Type the setup key below, or on your phone tap
            &ldquo;Open in authenticator app&rdquo;. The key expires in 15 minutes.
          </p>
        </div>
        <div>
          <p className="label" id="mfa-key-label">
            Setup key
          </p>
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
      <form action={action} className="space-y-3" noValidate>
        <p className="text-sm font-semibold text-ink">2. Confirm with the code your app shows now</p>
        <CodeField id="mfa-confirm" error={state?.fieldErrors?.code} />
        {state?.error && !state.fieldErrors ? <FormMessage state={state} /> : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending="Checking">Turn on authenticator app</SubmitButton>
          <Button
            variant="quiet"
            onClick={() => {
              setSetup(null);
              onEnrolling(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ---------- recovery codes ---------- */

function RecoveryRow({ totp, passkeys }: { totp: boolean; passkeys: boolean }) {
  const [codes, regen] = useActionState<RecoveryState, FormData>(newRecoveryCodes, null);
  return (
    <SettingsRow label="Recovery codes" description="Each signs you in once if you lose your devices. Make a new set if you've used some or think they've been seen; the old set stops working.">
      {codes?.recoveryCodes ? (
        <RecoveryCodes codes={codes.recoveryCodes} />
      ) : (
        <form action={regen} className="space-y-3" noValidate>
          <SecondFactorProof id="mfa-regen" totp={totp} passkeys={passkeys} error={codes?.fieldErrors?.code} />
          {codes?.error && !codes.fieldErrors ? <FormMessage state={codes} /> : null}
          <SubmitButton variant="ghost" pending="Creating">
            Create new recovery codes
          </SubmitButton>
        </form>
      )}
    </SettingsRow>
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

export function PasswordSection({ mfa, totp, passkeys, changedAt, hint }: { mfa: boolean; totp: boolean; passkeys: boolean; changedAt?: string; hint: string }) {
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
          {mfa ? <SecondFactorProof id="pw-code" totp={totp} passkeys={passkeys} error={fe?.code} /> : null}
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
