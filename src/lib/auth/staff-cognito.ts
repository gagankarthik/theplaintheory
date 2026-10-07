import "server-only";
import { randomBytes } from "node:crypto";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  AssociateSoftwareTokenCommand,
  InitiateAuthCommand,
  ListUsersInGroupCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
  VerifySoftwareTokenCommand,
  type AttributeType,
  type AuthenticationResultType,
  type ChallengeNameType,
} from "@aws-sdk/client-cognito-identity-provider";
import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { awsRegion, cognitoClient } from "../aws";
import type { StaffIdentity } from "../types";
import { cognitoErrorName } from "./cognito-errors";
import { PLATFORM_ROLES, staffGroupName, type PlatformRole, type StaffMember } from "./platform";
import {
  STAFF_NO_ROLE,
  STAFF_UNAVAILABLE,
  classifyStaffError,
  staffIssuer,
  staffJwksUrl,
  verifyStaffIdToken,
  type StaffAuthOp,
  type StaffChallenge,
  type StaffFailure,
} from "./staff-auth";

/**
 * The Plain Theory staff user pool (COGNITO_STAFF_POOL_ID / COGNITO_STAFF_CLIENT_ID), separate from
 * the customers pool in cognito.ts. Invite-only (AdminCreateUser; Cognito e-mails a temporary
 * password), TOTP required by the pool, no self-service recovery, and `platform-<role>` groups that
 * ARE the staff roles.
 *
 * Sign-in is a small state machine over USER_PASSWORD_AUTH:
 *   password -> NEW_PASSWORD_REQUIRED (first sign-in) -> MFA_SETUP (first sign-in) -> signed in
 *   password -> SOFTWARE_TOKEN_MFA (every later sign-in) -> signed in
 * Each step returns either the next challenge (whose Session the caller seals into an httpOnly
 * cookie) or a verified identity. Cognito's tokens are verified, then the refresh token is revoked:
 * the app keeps its own server-side staff session.
 *
 * Calls use the app's AWS credentials (aws.ts); the public auth calls only need the client id.
 */

const region = () => process.env.COGNITO_REGION || awsRegion;
const poolId = () => {
  const id = process.env.COGNITO_STAFF_POOL_ID;
  if (!id) throw new Error("COGNITO_STAFF_POOL_ID is not set");
  return id;
};
const clientId = () => {
  const id = process.env.COGNITO_STAFF_CLIENT_ID;
  if (!id) throw new Error("COGNITO_STAFF_CLIENT_ID is not set");
  return id;
};

const norm = (email: string) => email.trim().toLowerCase();

/** Log a provider error without the request (it can hold a password, code or session). */
function logError(op: string, e: unknown) {
  console.error(`[staff-cognito] ${op} failed: ${cognitoErrorName(e)}${e instanceof Error && e.message ? ` (${e.message.slice(0, 200)})` : ""}`);
}

let jwks: { url: string; get: JWTVerifyGetKey } | undefined;
function staffJwks() {
  const url = staffJwksUrl(region(), poolId());
  if (jwks?.url !== url) jwks = { url, get: createRemoteJWKSet(new URL(url)) };
  return jwks.get;
}

/* ---------------- sign-in ---------------- */

export type StaffAuthOutcome =
  | { kind: "challenge"; challenge: Omit<StaffChallenge, "expiresAt"> }
  | { kind: "signed_in"; identity: StaffIdentity }
  | { kind: "failed"; failure: StaffFailure };

const failed = (failure: StaffFailure): StaffAuthOutcome => ({ kind: "failed", failure });

function failFrom(e: unknown, op: StaffAuthOp, call: string): StaffAuthOutcome {
  const failure = classifyStaffError(e, op);
  if (failure.kind === "unavailable") logError(call, e);
  return failed(failure);
}

async function revokeRefreshToken(token: string | undefined) {
  if (!token) return;
  try {
    await cognitoClient().send(new RevokeTokenCommand({ ClientId: clientId(), Token: token }));
  } catch (e) {
    logError("RevokeToken", e);
  }
}

/** Tokens arrived: verify the ID token, read the role, and drop Cognito's refresh token. */
async function signedIn(auth: AuthenticationResultType): Promise<StaffAuthOutcome> {
  await revokeRefreshToken(auth.RefreshToken);
  if (!auth.IdToken) return failed({ kind: "unavailable", message: STAFF_UNAVAILABLE, name: "NoIdToken" });
  const v = await verifyStaffIdToken(auth.IdToken, { jwks: staffJwks(), issuer: staffIssuer(region(), poolId()), clientId: clientId() });
  if (!v.ok) {
    if (v.reason === "no_role") return failed({ kind: "no_role", message: STAFF_NO_ROLE, name: "NoStaffGroup" });
    console.error("[staff-cognito] ID token failed verification");
    return failed({ kind: "unavailable", message: STAFF_UNAVAILABLE, name: "InvalidIdToken" });
  }
  return { kind: "signed_in", identity: v.identity };
}

/** Turn any auth response into the next step. MFA_SETUP starts TOTP association straight away. */
async function next(
  r: { ChallengeName?: ChallengeNameType; Session?: string; ChallengeParameters?: Record<string, string>; AuthenticationResult?: AuthenticationResultType },
  ctx: { email: string; username: string; next?: string },
): Promise<StaffAuthOutcome> {
  if (r.AuthenticationResult) return signedIn(r.AuthenticationResult);
  const username = r.ChallengeParameters?.USER_ID_FOR_SRP || ctx.username;
  const base = { email: ctx.email, username, next: ctx.next };
  if (!r.Session) return failed({ kind: "unavailable", message: STAFF_UNAVAILABLE, name: "NoSession" });
  switch (r.ChallengeName) {
    case "NEW_PASSWORD_REQUIRED":
      return { kind: "challenge", challenge: { ...base, step: "new_password", session: r.Session } };
    case "SOFTWARE_TOKEN_MFA":
      return { kind: "challenge", challenge: { ...base, step: "mfa", session: r.Session } };
    case "MFA_SETUP": {
      try {
        const a = await cognitoClient().send(new AssociateSoftwareTokenCommand({ Session: r.Session }));
        if (!a.SecretCode || !a.Session) return failed({ kind: "unavailable", message: STAFF_UNAVAILABLE, name: "NoSecretCode" });
        return { kind: "challenge", challenge: { ...base, step: "mfa_setup", session: a.Session, secret: a.SecretCode } };
      } catch (e) {
        return failFrom(e, "mfaSetup", "AssociateSoftwareToken");
      }
    }
    default:
      console.error(`[staff-cognito] unsupported challenge ${r.ChallengeName}`);
      return failed({ kind: "unavailable", message: "This staff account needs a sign-in step the console doesn't support. Ask a superadmin.", name: String(r.ChallengeName) });
  }
}

/** Step 1: email and password. */
export async function staffSignIn(emailRaw: string, password: string, nextPath?: string): Promise<StaffAuthOutcome> {
  const email = norm(emailRaw);
  try {
    const r = await cognitoClient().send(new InitiateAuthCommand({ ClientId: clientId(), AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: email, PASSWORD: password } }));
    return next(r, { email, username: email, next: nextPath });
  } catch (e) {
    return failFrom(e, "signIn", "InitiateAuth");
  }
}

/** First sign-in: replace the e-mailed temporary password. */
export async function staffSetNewPassword(c: StaffChallenge, newPassword: string): Promise<StaffAuthOutcome> {
  try {
    const r = await cognitoClient().send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId(),
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: c.session,
        ChallengeResponses: { USERNAME: c.username, NEW_PASSWORD: newPassword },
      }),
    );
    return next(r, c);
  } catch (e) {
    return failFrom(e, "newPassword", "RespondToAuthChallenge(NEW_PASSWORD_REQUIRED)");
  }
}

/** First sign-in: prove the authenticator app has the secret, then finish the MFA_SETUP challenge. */
export async function staffConfirmMfaSetup(c: StaffChallenge, code: string): Promise<StaffAuthOutcome> {
  let session: string;
  try {
    const v = await cognitoClient().send(new VerifySoftwareTokenCommand({ Session: c.session, UserCode: code, FriendlyDeviceName: "Plain Theory staff console" }));
    if (v.Status !== "SUCCESS" || !v.Session) return failFrom({ name: "CodeMismatchException" }, "mfaSetup", "VerifySoftwareToken");
    session = v.Session;
  } catch (e) {
    return failFrom(e, "mfaSetup", "VerifySoftwareToken");
  }
  try {
    const r = await cognitoClient().send(new RespondToAuthChallengeCommand({ ClientId: clientId(), ChallengeName: "MFA_SETUP", Session: session, ChallengeResponses: { USERNAME: c.username } }));
    return next(r, c);
  } catch (e) {
    return failFrom(e, "mfaSetup", "RespondToAuthChallenge(MFA_SETUP)");
  }
}

/** Every later sign-in: the current code from the authenticator app. */
export async function staffVerifyMfa(c: StaffChallenge, code: string): Promise<StaffAuthOutcome> {
  try {
    const r = await cognitoClient().send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId(),
        ChallengeName: "SOFTWARE_TOKEN_MFA",
        Session: c.session,
        ChallengeResponses: { USERNAME: c.username, SOFTWARE_TOKEN_MFA_CODE: code },
      }),
    );
    return next(r, c);
  } catch (e) {
    return failFrom(e, "mfa", "RespondToAuthChallenge(SOFTWARE_TOKEN_MFA)");
  }
}

/* ---------------- staff management (superadmin) ---------------- */

export interface StaffAccount extends StaffMember {
  /** the pool's username (a UUID here, equal to sub); what Admin* calls take */
  username: string;
  name: string;
  /** Cognito UserStatus: FORCE_CHANGE_PASSWORD until the first sign-in, then CONFIRMED */
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AdminResult = { ok: true } | { ok: false; error: string };

const attr = (attrs: AttributeType[] | undefined, name: string) => attrs?.find((a) => a.Name === name)?.Value;

function adminFailure(op: string, e: unknown): { ok: false; error: string } {
  const name = cognitoErrorName(e);
  if (name === "UserNotFoundException") return { ok: false, error: "That staff account no longer exists. Refresh the list." };
  if (name === "UsernameExistsException") return { ok: false, error: "Someone with this email already has a staff account." };
  if (name === "LimitExceededException" || name === "TooManyRequestsException") return { ok: false, error: "Cognito is throttling requests. Wait a minute and try again." };
  if (name === "UnsupportedUserStateException") return { ok: false, error: "This person has already signed in, so there's no invite to resend. Use Reset password instead." };
  if (name === "InvalidParameterException") return { ok: false, error: "Cognito rejected that change. Check the email and name and try again." };
  logError(op, e);
  return { ok: false, error: "The staff directory didn't respond. Try again in a minute." };
}

/** Everyone in a platform-* group, with their highest role and account status. */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const byUser = new Map<string, StaffAccount>();
  for (const role of PLATFORM_ROLES) {
    let token: string | undefined;
    do {
      const r = await cognitoClient().send(new ListUsersInGroupCommand({ UserPoolId: poolId(), GroupName: staffGroupName(role), Limit: 60, NextToken: token }));
      for (const u of r.Users ?? []) {
        if (!u.Username || byUser.has(u.Username)) continue; // roles are visited highest first
        const email = (attr(u.Attributes, "email") ?? "").toLowerCase();
        byUser.set(u.Username, {
          username: u.Username,
          sub: attr(u.Attributes, "sub") ?? u.Username,
          email,
          name: attr(u.Attributes, "name") || email.split("@")[0] || u.Username,
          role,
          enabled: u.Enabled !== false,
          status: u.UserStatus ?? "UNKNOWN",
          createdAt: u.UserCreateDate?.toISOString(),
          updatedAt: u.UserLastModifiedDate?.toISOString(),
        });
      }
      token = r.NextToken;
    } while (token);
  }
  return [...byUser.values()].sort((a, b) => PLATFORM_ROLES.indexOf(a.role) - PLATFORM_ROLES.indexOf(b.role) || a.email.localeCompare(b.email));
}

/**
 * Invite someone: Cognito creates the account and e-mails a temporary password (its default
 * sender), then they're added to the role's group. If the group step fails the account is removed
 * again, so there's never a staff account without a role.
 */
export async function inviteStaff(input: { email: string; name: string; role: PlatformRole; temporaryPassword?: string; suppressEmail?: boolean }): Promise<({ ok: true } & { username: string; sub: string }) | { ok: false; error: string }> {
  const email = norm(input.email);
  let username: string;
  let sub: string;
  try {
    const r = await cognitoClient().send(
      new AdminCreateUserCommand({
        UserPoolId: poolId(),
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: input.name.trim() },
        ],
        TemporaryPassword: input.temporaryPassword,
        ...(input.suppressEmail ? { MessageAction: "SUPPRESS" as const } : { DesiredDeliveryMediums: ["EMAIL" as const] }),
      }),
    );
    username = r.User!.Username!;
    sub = attr(r.User?.Attributes, "sub") ?? username;
  } catch (e) {
    return adminFailure("AdminCreateUser", e);
  }
  try {
    await cognitoClient().send(new AdminAddUserToGroupCommand({ UserPoolId: poolId(), Username: username, GroupName: staffGroupName(input.role) }));
  } catch (e) {
    await cognitoClient()
      .send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: username }))
      .catch((d) => logError("AdminDeleteUser (rollback)", d));
    return adminFailure("AdminAddUserToGroup", e);
  }
  return { ok: true, username, sub };
}

/** Move someone to another role: join the new group first, so they're never without one. */
export async function setStaffRole(username: string, from: PlatformRole, to: PlatformRole): Promise<AdminResult> {
  try {
    await cognitoClient().send(new AdminAddUserToGroupCommand({ UserPoolId: poolId(), Username: username, GroupName: staffGroupName(to) }));
    // Leave every other platform group (someone could have been put in two by hand).
    for (const r of PLATFORM_ROLES) {
      if (r === to) continue;
      await cognitoClient()
        .send(new AdminRemoveUserFromGroupCommand({ UserPoolId: poolId(), Username: username, GroupName: staffGroupName(r) }))
        .catch((e) => {
          if (r === from) throw e;
        });
    }
    return { ok: true };
  } catch (e) {
    return adminFailure("staff role change", e);
  }
}

/** Send the invite e-mail again with a new temporary password (only before their first sign-in). */
export async function resendStaffInvite(username: string): Promise<AdminResult> {
  try {
    await cognitoClient().send(new AdminCreateUserCommand({ UserPoolId: poolId(), Username: username, MessageAction: "RESEND", DesiredDeliveryMediums: ["EMAIL"] }));
    return { ok: true };
  } catch (e) {
    return adminFailure("AdminCreateUser (RESEND)", e);
  }
}

/** A throwaway password that meets the pool policy (12+, lowercase, digit, symbol). */
export const randomTemporaryPassword = () => `Pt-${randomBytes(18).toString("base64url")}-7x!`;

/**
 * Reset a password. The pool has no self-service recovery, so this puts the account back to
 * FORCE_CHANGE_PASSWORD with a random temporary password and, unless `deliver` is false, e-mails a
 * fresh one through the invite message. Their authenticator stays enrolled. Signs them out of Cognito.
 */
export async function resetStaffPassword(username: string, opts: { deliver?: boolean; temporaryPassword?: string } = {}): Promise<AdminResult> {
  try {
    await cognitoClient().send(new AdminSetUserPasswordCommand({ UserPoolId: poolId(), Username: username, Password: opts.temporaryPassword ?? randomTemporaryPassword(), Permanent: false }));
  } catch (e) {
    return adminFailure("AdminSetUserPassword", e);
  }
  await staffGlobalSignOut(username);
  return opts.deliver === false ? { ok: true } : resendStaffInvite(username);
}

export async function setStaffEnabled(username: string, enabled: boolean): Promise<AdminResult> {
  try {
    await cognitoClient().send(enabled ? new AdminEnableUserCommand({ UserPoolId: poolId(), Username: username }) : new AdminDisableUserCommand({ UserPoolId: poolId(), Username: username }));
  } catch (e) {
    return adminFailure(enabled ? "AdminEnableUser" : "AdminDisableUser", e);
  }
  if (!enabled) await staffGlobalSignOut(username);
  return { ok: true };
}

export async function deleteStaff(username: string): Promise<AdminResult> {
  try {
    await cognitoClient().send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: username }));
    return { ok: true };
  } catch (e) {
    return adminFailure("AdminDeleteUser", e);
  }
}

/** Invalidate every Cognito refresh token for the person. Best effort; app sessions are revoked separately. */
export async function staffGlobalSignOut(username: string): Promise<boolean> {
  try {
    await cognitoClient().send(new AdminUserGlobalSignOutCommand({ UserPoolId: poolId(), Username: username }));
    return true;
  } catch (e) {
    if (cognitoErrorName(e) !== "UserNotFoundException") logError("AdminUserGlobalSignOut", e);
    return false;
  }
}
