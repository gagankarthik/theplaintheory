import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import { site } from "../site";
import { getStore } from "../store";
import type { Passkey, User, WebAuthnChallenge } from "../types";
import { SETUP_DONE } from "./mfa";
import { expectedOriginsFor, liveChallenge, passkeysOf, rpIdFor, withPasskey } from "./second-factor";
import { generateRecoveryCodes } from "./totp";

/**
 * Passkeys (WebAuthn) as a second factor. The challenge lives on the user record, never trusted from
 * the browser, and is cleared before each verification so it can't be replayed.
 * Relying party: site.url's hostname without "www."; origins: the site origin and its www/apex twin.
 */

const rp = () => ({ rpID: rpIdFor(site.url), origins: expectedOriginsFor(site.url) });
const toBytes = (b64url: string) => new Uint8Array(Buffer.from(b64url, "base64url"));
const toB64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

/** Light shape check on what the browser sent; the library verifies everything that matters. */
const credentialJson = z.object({
  id: z.string().min(1).max(1024),
  rawId: z.string().min(1).max(1024),
  type: z.literal("public-key"),
  response: z.record(z.string(), z.unknown()),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional().default({}),
  authenticatorAttachment: z.string().optional(),
});

export function parseRegistrationJson(v: unknown): RegistrationResponseJSON | null {
  const r = credentialJson.safeParse(v);
  return r.success ? (r.data as unknown as RegistrationResponseJSON) : null;
}
export function parseAuthenticationJson(v: unknown): AuthenticationResponseJSON | null {
  const r = credentialJson.safeParse(v);
  return r.success ? (r.data as unknown as AuthenticationResponseJSON) : null;
}

async function saveChallenge(userId: string, challenge: string, purpose: WebAuthnChallenge["purpose"]) {
  await (await getStore()).updateUser(userId, { webauthnChallenge: { challenge, purpose, createdAt: new Date().toISOString() } });
}

/**
 * Single use: read the newest record, clear the challenge whatever happens next, and return it only
 * if it's for this ceremony and under 5 minutes old.
 */
export async function takeChallenge(userId: string, purpose: WebAuthnChallenge["purpose"]) {
  const store = await getStore();
  const fresh = await store.getUser(userId);
  const stored = fresh?.webauthnChallenge;
  if (!fresh || !stored) return { user: fresh, challenge: null };
  // Read before clearing: the local store hands back its live record.
  const challenge = liveChallenge(stored, purpose);
  const user = await store.updateUser(userId, { webauthnChallenge: undefined });
  return { user, challenge };
}

/* ---------------- registration ---------------- */

export async function passkeyRegistrationOptions(user: User): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const options = await generateRegistrationOptions({
    rpName: site.name,
    rpID: rp().rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    // the same authenticator can't be added twice
    excludeCredentials: passkeysOf(user.mfa).map((p) => ({ id: p.id, transports: p.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await saveChallenge(user.id, options.challenge, "register");
  return options;
}

export type RegistrationResult =
  | { ok: true; passkey: Passkey; firstFactor: boolean; recoveryCodes?: string[] }
  | { ok: false; reason: "expired" | "invalid" | "duplicate" };

export async function verifyPasskeyRegistration(userId: string, response: RegistrationResponseJSON, name: string): Promise<RegistrationResult> {
  const { user, challenge } = await takeChallenge(userId, "register");
  if (!user || !challenge) return { ok: false, reason: "expired" };
  const { rpID, origins } = rp();
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: false });
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!verification.verified) return { ok: false, reason: "invalid" };
  const cred = verification.registrationInfo.credential;
  if (passkeysOf(user.mfa).some((p) => p.id === cred.id)) return { ok: false, reason: "duplicate" };

  const passkey: Passkey = {
    id: cred.id,
    publicKey: toB64url(cred.publicKey),
    counter: cred.counter,
    ...(cred.transports?.length ? { transports: cred.transports } : {}),
    name,
    createdAt: new Date().toISOString(),
  };
  const firstFactor = !user.mfa;
  const recovery = firstFactor ? generateRecoveryCodes() : null;
  const mfa = withPasskey(user.mfa, passkey, recovery?.hashes ?? []);
  await (await getStore()).updateUser(user.id, { mfa, ...SETUP_DONE });
  return { ok: true, passkey, firstFactor, recoveryCodes: recovery?.plain };
}

/* ---------------- authentication (sign-in or a fresh check) ---------------- */

export async function passkeyAuthenticationOptions(user: User): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: rp().rpID,
    allowCredentials: passkeysOf(user.mfa).map((p) => ({ id: p.id, transports: p.transports })),
    userVerification: "preferred",
  });
  await saveChallenge(user.id, options.challenge, "authenticate");
  return options;
}

export type AssertionResult =
  | { ok: true; passkey: Passkey }
  /** "counter": the signature counter went backwards, a sign the key may have been copied */
  | { ok: false; reason: "expired" | "unknown" | "invalid" | "counter"; passkey?: Passkey };

export async function verifyPasskeyAssertion(userId: string, response: AuthenticationResponseJSON): Promise<AssertionResult> {
  const { user, challenge } = await takeChallenge(userId, "authenticate");
  if (!user || !challenge) return { ok: false, reason: "expired" };
  const passkey = passkeysOf(user.mfa).find((p) => p.id === response.id);
  if (!passkey) return { ok: false, reason: "unknown" };
  const { rpID, origins } = rp();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: { id: passkey.id, publicKey: toBytes(passkey.publicKey), counter: passkey.counter, transports: passkey.transports },
      requireUserVerification: false,
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error && /counter/i.test(e.message) ? "counter" : "invalid", passkey };
  }
  if (!verification.verified) return { ok: false, reason: "invalid", passkey };

  const used: Passkey = { ...passkey, counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() };
  const mfa = user.mfa!;
  await (await getStore()).updateUser(user.id, { mfa: { ...mfa, passkeys: passkeysOf(mfa).map((p) => (p.id === used.id ? used : p)) } });
  return { ok: true, passkey: used };
}
