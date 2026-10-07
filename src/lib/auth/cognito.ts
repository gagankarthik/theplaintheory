import "server-only";
import { createHmac } from "node:crypto";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminUserGlobalSignOutCommand,
  ChangePasswordCommand,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { decodeJwt } from "jose";
import { cognitoClient } from "../aws";
import { ACCOUNT_EXISTS, classifyCognitoError, cognitoErrorName, type CognitoFailure, type CognitoFailureKind } from "./cognito-errors";

/**
 * Amazon Cognito customers pool calls (AUTH_DRIVER=cognito). Plain Theory staff have their own pool
 * (staff-cognito.ts); e-mail is the username here (case-insensitive). Cognito proves identity; the app then issues its
 * own server-side session, runs its own TOTP second factor, lockout and RBAC (see provider.ts).
 *
 * Every function returns a result instead of throwing, with Cognito exceptions classified in
 * cognito-errors.ts. Admin calls (global sign-out, user status) use the app's AWS
 * credentials from aws.ts; the public client calls only need the app client id.
 */

/** The customers pool (pt-<stage>-aps1-customers). Staff sign in through their own pool: staff-cognito.ts. */
const clientId = () => {
  const id = process.env.COGNITO_CUSTOMER_CLIENT_ID;
  if (!id) throw new Error("COGNITO_CUSTOMER_CLIENT_ID is not set");
  return id;
};
const poolId = () => {
  const id = process.env.COGNITO_CUSTOMER_POOL_ID;
  if (!id) throw new Error("COGNITO_CUSTOMER_POOL_ID is not set");
  return id;
};

/** Only for app clients created with a secret; ours has none, so this is normally undefined. */
const secretHash = (username: string) => {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  return secret ? createHmac("sha256", secret).update(username + clientId()).digest("base64") : undefined;
};

const norm = (email: string) => email.trim().toLowerCase();

type Fail = { ok: false; failure: CognitoFailure };
const fail = (failure: CognitoFailure): Fail => ({ ok: false, failure });
const failKind = (kind: CognitoFailureKind, message: string, name: string = kind): Fail => ({ ok: false, failure: { kind, message, name } });

/** Log an unexpected provider error without the request payload (it can hold a password). */
function logProviderError(op: string, e: unknown) {
  console.error(`[cognito] ${op} failed: ${cognitoErrorName(e)}${e instanceof Error && e.message ? ` (${e.message.slice(0, 200)})` : ""}`);
}

/** Result of a best-effort admin side effect, reported back to the caller rather than thrown. */
export type SyncResult = { status: "ok" } | { status: "skipped"; reason: string } | { status: "failed"; error: string };

/* ---------------- sign-up and confirmation ---------------- */

async function signUpOnce(email: string, password: string, name: string) {
  const r = await cognitoClient().send(
    new SignUpCommand({
      ClientId: clientId(),
      SecretHash: secretHash(email),
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: name },
      ],
    }),
  );
  return r.UserSub!;
}

/** Cognito's status for a user (UNCONFIRMED, CONFIRMED, FORCE_CHANGE_PASSWORD, ...), or null when there's none. */
export async function cognitoUserStatus(emailRaw: string): Promise<string | null> {
  try {
    const r = await cognitoClient().send(new AdminGetUserCommand({ UserPoolId: poolId(), Username: norm(emailRaw) }));
    return r.UserStatus ?? null;
  } catch (e) {
    if (cognitoErrorName(e) === "UserNotFoundException") return null;
    throw e;
  }
}

/**
 * Create a user; Cognito e-mails a 6-digit confirmation code.
 *
 * If the address already has an UNCONFIRMED account (an abandoned sign-up, or someone else typing
 * this address), that account is replaced: nobody has proved they own the inbox yet, and keeping it
 * would leave the earlier password in place for whoever confirms. The new SignUp sends a fresh code.
 * A confirmed account is reported as `exists`.
 */
export async function cognitoRegister(emailRaw: string, password: string, name: string): Promise<{ ok: true; sub: string; replaced: boolean } | Fail> {
  const email = norm(emailRaw);
  try {
    return { ok: true, sub: await signUpOnce(email, password, name), replaced: false };
  } catch (e) {
    const failure = classifyCognitoError(e, "signUp");
    if (failure.kind !== "exists") {
      if (failure.kind === "unavailable") logProviderError("SignUp", e);
      return fail(failure);
    }
  }
  try {
    if ((await cognitoUserStatus(email)) !== "UNCONFIRMED") return failKind("exists", ACCOUNT_EXISTS, "UsernameExistsException");
    await cognitoClient().send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: email }));
    return { ok: true, sub: await signUpOnce(email, password, name), replaced: true };
  } catch (e) {
    const failure = classifyCognitoError(e, "signUp");
    if (failure.kind === "unavailable") logProviderError("SignUp (replace unconfirmed)", e);
    return fail(failure);
  }
}

/** Confirm the e-mail with the 6-digit code. An account that's already confirmed counts as success. */
export async function cognitoConfirmSignUp(emailRaw: string, code: string): Promise<{ ok: true; alreadyConfirmed: boolean } | Fail> {
  const email = norm(emailRaw);
  try {
    await cognitoClient().send(new ConfirmSignUpCommand({ ClientId: clientId(), SecretHash: secretHash(email), Username: email, ConfirmationCode: code }));
    return { ok: true, alreadyConfirmed: false };
  } catch (e) {
    const failure = classifyCognitoError(e, "confirmSignUp");
    if (failure.kind === "already_confirmed") return { ok: true, alreadyConfirmed: true };
    if (failure.kind === "unavailable") logProviderError("ConfirmSignUp", e);
    return fail(failure);
  }
}

/**
 * Send a new confirmation code. The answer is the same whether or not the address has an
 * unconfirmed account (no enumeration); only provider throttling is reported.
 */
export async function cognitoResendCode(emailRaw: string): Promise<{ ok: true } | Fail> {
  const email = norm(emailRaw);
  try {
    await cognitoClient().send(new ResendConfirmationCodeCommand({ ClientId: clientId(), SecretHash: secretHash(email), Username: email }));
  } catch (e) {
    const name = cognitoErrorName(e);
    if (name !== "UserNotFoundException" && name !== "InvalidParameterException" && name !== "LimitExceededException") logProviderError("ResendConfirmationCode", e);
  }
  return { ok: true };
}

/* ---------------- sign-in ---------------- */

export interface CognitoIdentity {
  sub: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

/**
 * USER_PASSWORD_AUTH. Returns the identity from the ID token plus the tokens, for callers that need
 * to act as the user (password change). Most callers want cognitoSignIn, which discards the tokens.
 */
export async function cognitoAuthenticate(
  emailRaw: string,
  password: string,
): Promise<{ ok: true; identity: CognitoIdentity; accessToken: string; refreshToken?: string } | Fail> {
  const email = norm(emailRaw);
  try {
    const r = await cognitoClient().send(
      new InitiateAuthCommand({
        ClientId: clientId(),
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: password, ...(secretHash(email) ? { SECRET_HASH: secretHash(email)! } : {}) },
      }),
    );
    if (r.ChallengeName) {
      // The app runs its own second factor; Cognito MFA and forced password changes aren't used.
      if (r.ChallengeName === "NEW_PASSWORD_REQUIRED") return failKind("reset_required", "Reset your password to continue. Use Forgot password to get a code by email.", r.ChallengeName);
      return failKind("unavailable", "This account needs a sign-in step we don't support here. Contact support@theplaintheory.in.", r.ChallengeName);
    }
    const auth = r.AuthenticationResult;
    if (!auth?.IdToken || !auth.AccessToken) return failKind("unavailable", "Sign-in is unavailable right now. Try again in a minute.", "NoTokens");
    // The ID token came straight from Cognito over TLS in this call, so reading its claims is safe.
    const claims = decodeJwt(auth.IdToken);
    const identity: CognitoIdentity = {
      sub: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email.toLowerCase() : email,
      name: typeof claims.name === "string" ? claims.name : undefined,
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
    };
    return { ok: true, identity, accessToken: auth.AccessToken, refreshToken: auth.RefreshToken };
  } catch (e) {
    const failure = classifyCognitoError(e, "signIn");
    if (failure.kind === "unavailable") logProviderError("InitiateAuth", e);
    return fail(failure);
  }
}

/** Revoke a refresh token (and the access tokens issued from it). Best effort. */
export async function cognitoRevokeRefreshToken(token: string | undefined) {
  if (!token) return;
  try {
    await cognitoClient().send(new RevokeTokenCommand({ ClientId: clientId(), Token: token }));
  } catch (e) {
    logProviderError("RevokeToken", e);
  }
}

/**
 * Verify an e-mail and password and return who it is. The app keeps its own session, so Cognito's
 * tokens are revoked straight away rather than left valid and unused.
 */
export async function cognitoSignIn(email: string, password: string): Promise<{ ok: true; identity: CognitoIdentity } | Fail> {
  const r = await cognitoAuthenticate(email, password);
  if (!r.ok) return r;
  await cognitoRevokeRefreshToken(r.refreshToken);
  return { ok: true, identity: r.identity };
}

/* ---------------- passwords ---------------- */

/** Change the password as the user, with an access token from a fresh cognitoAuthenticate. */
export async function cognitoChangePassword(accessToken: string, previous: string, proposed: string): Promise<{ ok: true } | Fail> {
  try {
    await cognitoClient().send(new ChangePasswordCommand({ AccessToken: accessToken, PreviousPassword: previous, ProposedPassword: proposed }));
    return { ok: true };
  } catch (e) {
    const failure = classifyCognitoError(e, "changePassword");
    if (failure.kind === "unavailable") logProviderError("ChangePassword", e);
    return fail(failure);
  }
}

/**
 * Start a reset: Cognito e-mails a code to a verified address. Always the same answer, whether the
 * account exists, is unconfirmed or has no verified e-mail (no enumeration).
 */
export async function cognitoForgotPassword(emailRaw: string): Promise<{ ok: true }> {
  const email = norm(emailRaw);
  try {
    await cognitoClient().send(new ForgotPasswordCommand({ ClientId: clientId(), SecretHash: secretHash(email), Username: email }));
  } catch (e) {
    const name = cognitoErrorName(e);
    if (!["UserNotFoundException", "InvalidParameterException", "LimitExceededException", "NotAuthorizedException", "UserNotConfirmedException"].includes(name)) {
      logProviderError("ForgotPassword", e);
    }
  }
  return { ok: true };
}

export async function cognitoConfirmForgotPassword(emailRaw: string, code: string, password: string): Promise<{ ok: true } | Fail> {
  const email = norm(emailRaw);
  try {
    await cognitoClient().send(
      new ConfirmForgotPasswordCommand({ ClientId: clientId(), SecretHash: secretHash(email), Username: email, ConfirmationCode: code, Password: password }),
    );
    return { ok: true };
  } catch (e) {
    const failure = classifyCognitoError(e, "confirmForgotPassword");
    if (failure.kind === "unavailable") logProviderError("ConfirmForgotPassword", e);
    return fail(failure);
  }
}

/* ---------------- admin side effects ---------------- */

/** Invalidate every Cognito refresh token for the user (sign out everywhere, password resets). */
export async function cognitoGlobalSignOut(emailRaw: string): Promise<SyncResult> {
  try {
    await cognitoClient().send(new AdminUserGlobalSignOutCommand({ UserPoolId: poolId(), Username: norm(emailRaw) }));
    return { status: "ok" };
  } catch (e) {
    if (cognitoErrorName(e) === "UserNotFoundException") return { status: "skipped", reason: "no Cognito account" };
    logProviderError("AdminUserGlobalSignOut", e);
    return { status: "failed", error: cognitoErrorName(e) };
  }
}
