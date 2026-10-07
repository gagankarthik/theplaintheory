import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "vite";

/**
 * Runs against the REAL Cognito user pool. Skipped unless RUN_COGNITO_INTEGRATION=1:
 *
 *   RUN_COGNITO_INTEGRATION=1 npx vitest run tests/integration/cognito.integration.test.ts
 *
 * Reads COGNITO_* and AWS credentials from .env.local (or the default AWS chain). Creates one user at
 * pt-it-<random>@theplaintheory.in, confirms it with AdminConfirmSignUp (no inbox needed) and deletes
 * it in afterAll, whatever happens in between.
 */
const RUN = process.env.RUN_COGNITO_INTEGRATION === "1";

type CognitoModule = typeof import("@/lib/auth/cognito");
type Sdk = typeof import("@aws-sdk/client-cognito-identity-provider");

describe.skipIf(!RUN)("Cognito user pool (integration)", () => {
  const email = `pt-it-${randomBytes(6).toString("hex")}@theplaintheory.in`;
  const password = `Violet-harbour-${randomBytes(3).toString("hex")}-47`;
  const newPassword = `Amber-lantern-${randomBytes(3).toString("hex")}-82`;
  let cognito: CognitoModule;
  let sdk: Sdk;
  let send: (cmd: unknown) => Promise<unknown>;
  let poolId: string;
  let created = false;

  beforeAll(async () => {
    // Load .env.local before the AWS client module reads credentials and region.
    const env = loadEnv("development", process.cwd(), "");
    for (const k of ["COGNITO_CUSTOMER_POOL_ID", "COGNITO_CUSTOMER_CLIENT_ID", "COGNITO_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION", "PT_AWS_REGION", "SESSION_SECRET"]) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    poolId = process.env.COGNITO_CUSTOMER_POOL_ID!;
    expect(poolId, "COGNITO_CUSTOMER_POOL_ID").toBeTruthy();
    cognito = await import("@/lib/auth/cognito");
    sdk = await import("@aws-sdk/client-cognito-identity-provider");
    const { cognitoClient } = await import("@/lib/aws");
    send = (cmd) => cognitoClient().send(cmd as never);
  });

  afterAll(async () => {
    if (!created) return;
    await send(new sdk.AdminDeleteUserCommand({ UserPoolId: poolId, Username: email })).catch(() => undefined);
    expect(await cognito.cognitoUserStatus(email)).toBeNull();
  });

  it("signs up an unconfirmed user", async () => {
    const r = await cognito.cognitoRegister(email, password, "Integration Test");
    expect(r.ok).toBe(true);
    created = true;
    if (r.ok) expect(r.replaced).toBe(false);
    expect(await cognito.cognitoUserStatus(email)).toBe("UNCONFIRMED");
  });

  it("replaces an unconfirmed account on a second sign-up instead of a dead end", async () => {
    const r = await cognito.cognitoRegister(email.toUpperCase(), password, "Integration Test");
    expect(r).toMatchObject({ ok: true, replaced: true });
  });

  it("reports an unconfirmed account at sign-in only with the right password", async () => {
    const right = await cognito.cognitoSignIn(email, password);
    expect(right.ok).toBe(false);
    if (!right.ok) expect(right.failure.kind).toBe("unconfirmed");
    const wrong = await cognito.cognitoSignIn(email, "Not-the-password-99");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.failure.kind).toBe("invalid_credentials");
  });

  it("rejects a wrong confirmation code", async () => {
    const r = await cognito.cognitoConfirmSignUp(email, "000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["code_mismatch", "code_expired"]).toContain(r.failure.kind);
  });

  it("signs in after confirmation, case-insensitively", async () => {
    await send(new sdk.AdminConfirmSignUpCommand({ UserPoolId: poolId, Username: email }));
    expect(await cognito.cognitoUserStatus(email)).toBe("CONFIRMED");
    const r = await cognito.cognitoSignIn(email.toUpperCase(), password);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.identity.email).toBe(email);
      expect(r.identity.name).toBe("Integration Test");
      expect(r.identity.sub).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("treats a repeat confirmation as success and a confirmed sign-up as existing", async () => {
    const again = await cognito.cognitoConfirmSignUp(email, "123456");
    // Cognito answers either "already confirmed" or a code error; neither may leak more.
    if (again.ok) expect(again.alreadyConfirmed).toBe(true);
    else expect(["code_mismatch", "code_expired"]).toContain(again.failure.kind);
    const r = await cognito.cognitoRegister(email, password, "Someone Else");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe("exists");
  });

  it("refuses a wrong password without saying whether the account exists", async () => {
    const known = await cognito.cognitoSignIn(email, "Wrong-password-12");
    const unknown = await cognito.cognitoSignIn(`pt-it-missing-${randomBytes(4).toString("hex")}@theplaintheory.in`, "Wrong-password-12");
    expect(known.ok || unknown.ok).toBe(false);
    if (!known.ok && !unknown.ok) {
      expect(known.failure.kind).toBe("invalid_credentials");
      expect(unknown.failure.message).toBe(known.failure.message);
    }
  });

  it("changes the password with the access token from a fresh sign-in", async () => {
    const auth = await cognito.cognitoAuthenticate(email, password);
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    const weak = await cognito.cognitoChangePassword(auth.accessToken, password, "short");
    expect(weak.ok).toBe(false);
    const changed = await cognito.cognitoChangePassword(auth.accessToken, password, newPassword);
    expect(changed).toEqual({ ok: true });
    await cognito.cognitoRevokeRefreshToken(auth.refreshToken);
    expect((await cognito.cognitoSignIn(email, newPassword)).ok).toBe(true);
    expect((await cognito.cognitoSignIn(email, password)).ok).toBe(false);
  });

  it("answers a forgot-password request the same way for known and unknown addresses", async () => {
    const known = await cognito.cognitoForgotPassword(email);
    const unknown = await cognito.cognitoForgotPassword(`pt-it-missing-${randomBytes(4).toString("hex")}@theplaintheory.in`);
    expect(known).toEqual(unknown);
    const resendUnknown = await cognito.cognitoResendCode(`pt-it-missing-${randomBytes(4).toString("hex")}@theplaintheory.in`);
    const resendConfirmed = await cognito.cognitoResendCode(email);
    expect(resendUnknown).toEqual(resendConfirmed);
    const reset = await cognito.cognitoConfirmForgotPassword(email, "000000", `Another-${randomBytes(3).toString("hex")}-93!`);
    expect(reset.ok).toBe(false);
    if (!reset.ok) expect(["code_mismatch", "code_expired", "throttled"]).toContain(reset.failure.kind);
  });

  it("signs out everywhere: tokens issued before stop working", async () => {
    const auth = await cognito.cognitoAuthenticate(email, newPassword);
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    await send(new sdk.GetUserCommand({ AccessToken: auth.accessToken }));
    expect(await cognito.cognitoGlobalSignOut(email)).toEqual({ status: "ok" });
    await expect(send(new sdk.GetUserCommand({ AccessToken: auth.accessToken }))).rejects.toMatchObject({ name: "NotAuthorizedException" });
    const missing = await cognito.cognitoGlobalSignOut(`pt-it-missing-${randomBytes(4).toString("hex")}@theplaintheory.in`);
    expect(missing.status).toBe("skipped");
  });

});
