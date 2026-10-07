import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "vite";

/**
 * Runs the staff sign-in state machine against the REAL staff user pool. Skipped unless
 * RUN_STAFF_COGNITO_INTEGRATION=1:
 *
 *   RUN_STAFF_COGNITO_INTEGRATION=1 npx vitest run tests/integration/staff-cognito.integration.test.ts
 *
 * - Setup and cleanup use ADMIN credentials from the default AWS chain (your CLI profile): one user at
 *   pt-it-staff-<random>@theplaintheory.in is created with a known temporary password and
 *   MessageAction SUPPRESS, so no e-mail is sent. It's deleted in afterAll whatever happens.
 * - The code under test (staff-cognito.ts) uses the app's least-privilege keys (PT_AWS_* from
 *   .env.local), proving its IAM policy covers the flow.
 * TOTP codes are computed from the secret Cognito returns, with the app's own TOTP helper.
 */
const RUN = process.env.RUN_STAFF_COGNITO_INTEGRATION === "1";

type StaffCognito = typeof import("@/lib/auth/staff-cognito");
type Sdk = typeof import("@aws-sdk/client-cognito-identity-provider");
type Totp = typeof import("@/lib/auth/totp");

describe.skipIf(!RUN)("staff Cognito pool (integration)", () => {
  const email = `pt-it-staff-${randomBytes(6).toString("hex")}@theplaintheory.in`;
  const temp = `Tmp-${randomBytes(6).toString("hex")}-a1!`;
  const password = `Cobalt-meadow-${randomBytes(4).toString("hex")}-38!`;
  const password2 = `Saffron-quay-${randomBytes(4).toString("hex")}-61!`;
  let staff: StaffCognito;
  let sdk: Sdk;
  let totp: Totp;
  let admin: { send: (cmd: unknown) => Promise<unknown> };
  let poolId: string;
  let username: string | undefined;
  let secret = "";
  let lastStep = 0;

  /** A code from a time step Cognito hasn't seen yet (it rejects a reused code). */
  async function freshCode() {
    while (totp.totpStep() <= lastStep) await new Promise((r) => setTimeout(r, 1000));
    lastStep = totp.totpStep();
    return totp.totp(secret);
  }

  beforeAll(async () => {
    const env = loadEnv("development", process.cwd(), "");
    // The module under test gets the app's keys; the admin client below uses the default chain.
    for (const k of ["COGNITO_STAFF_POOL_ID", "COGNITO_STAFF_CLIENT_ID", "COGNITO_REGION", "PT_AWS_REGION", "PT_AWS_ACCESS_KEY_ID", "PT_AWS_SECRET_ACCESS_KEY", "SESSION_SECRET"]) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    poolId = process.env.COGNITO_STAFF_POOL_ID!;
    expect(poolId, "COGNITO_STAFF_POOL_ID").toBeTruthy();
    sdk = await import("@aws-sdk/client-cognito-identity-provider");
    staff = await import("@/lib/auth/staff-cognito");
    totp = await import("@/lib/auth/totp");
    const client = new sdk.CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION || "ap-south-1" });
    admin = { send: (cmd) => client.send(cmd as never) };

    const r = (await admin.send(
      new sdk.AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: email,
        TemporaryPassword: temp,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: "Integration Staff" },
        ],
      }),
    )) as { User?: { Username?: string } };
    username = r.User?.Username;
    expect(username).toBeTruthy();
    await admin.send(new sdk.AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: username, GroupName: "platform-billing" }));
  }, 60_000);

  afterAll(async () => {
    if (!username) return;
    await admin.send(new sdk.AdminDeleteUserCommand({ UserPoolId: poolId, Username: username })).catch(() => undefined);
    const left = (await admin.send(new sdk.ListUsersCommand({ UserPoolId: poolId, Filter: `email = "${email}"` }))) as { Users?: unknown[] };
    expect(left.Users ?? []).toHaveLength(0);
  }, 60_000);

  it("refuses a wrong password without saying whether the account exists", async () => {
    const wrong = await staff.staffSignIn(email, "Definitely-wrong-9!");
    const nobody = await staff.staffSignIn(`pt-it-nobody-${randomBytes(4).toString("hex")}@theplaintheory.in`, "Definitely-wrong-9!");
    expect(wrong).toMatchObject({ kind: "failed", failure: { kind: "invalid_credentials" } });
    expect(nobody).toMatchObject({ kind: "failed", failure: { kind: "invalid_credentials" } });
    if (wrong.kind === "failed" && nobody.kind === "failed") expect(wrong.failure.message).toBe(nobody.failure.message);
  });

  it("first sign-in: NEW_PASSWORD_REQUIRED -> MFA_SETUP -> signed in with the group's role", async () => {
    const first = await staff.staffSignIn(email.toUpperCase(), temp, "/admin/orgs");
    expect(first.kind).toBe("challenge");
    if (first.kind !== "challenge") return;
    expect(first.challenge).toMatchObject({ step: "new_password", email, username, next: "/admin/orgs" });

    const weak = await staff.staffSetNewPassword({ ...first.challenge, expiresAt: 0 }, "short");
    expect(weak).toMatchObject({ kind: "failed", failure: { kind: "password_policy" } });

    // A rejected password used up that Session; start again with the temporary password.
    const again = await staff.staffSignIn(email, temp);
    expect(again).toMatchObject({ kind: "challenge", challenge: { step: "new_password" } });
    if (again.kind !== "challenge") return;
    const setup = await staff.staffSetNewPassword({ ...again.challenge, expiresAt: 0 }, password);
    expect(setup.kind).toBe("challenge");
    if (setup.kind !== "challenge") return;
    expect(setup.challenge.step).toBe("mfa_setup");
    expect(setup.challenge.secret).toMatch(/^[A-Z2-7]{16,}$/);
    secret = setup.challenge.secret!;

    const wrongCode = String((Number(totp.totp(secret)) + 1) % 1_000_000).padStart(6, "0");
    const rejected = await staff.staffConfirmMfaSetup({ ...setup.challenge, expiresAt: 0 }, wrongCode);
    expect(rejected).toMatchObject({ kind: "failed", failure: { kind: "code_mismatch" } });

    const done = await staff.staffConfirmMfaSetup({ ...setup.challenge, expiresAt: 0 }, await freshCode());
    expect(done.kind, done.kind === "failed" ? `${done.failure.kind}: ${done.failure.name}` : "").toBe("signed_in");
    if (done.kind !== "signed_in") return;
    expect(done.identity).toMatchObject({ email, name: "Integration Staff", role: "billing" });
    expect(done.identity.sub).toBe(username);
  }, 120_000);

  it("later sign-ins: SOFTWARE_TOKEN_MFA every time", async () => {
    const first = await staff.staffSignIn(email, password);
    expect(first).toMatchObject({ kind: "challenge", challenge: { step: "mfa" } });
    if (first.kind !== "challenge") return;
    const bad = await staff.staffVerifyMfa({ ...first.challenge, expiresAt: 0 }, "000000");
    expect(bad).toMatchObject({ kind: "failed", failure: { kind: "code_mismatch" } });
    // The same Session takes a corrected code (the verify page keeps the challenge cookie).
    const done = await staff.staffVerifyMfa({ ...first.challenge, expiresAt: 0 }, await freshCode());
    expect(done).toMatchObject({ kind: "signed_in", identity: { email, role: "billing" } });
  }, 120_000);

  it("lists staff and changes roles through the groups (app credentials)", async () => {
    const before = (await staff.listStaffAccounts()).find((s) => s.username === username);
    expect(before).toMatchObject({ email, role: "billing", enabled: true, status: "CONFIRMED", name: "Integration Staff" });
    expect(await staff.setStaffRole(username!, "billing", "analyst")).toEqual({ ok: true });
    const after = (await staff.listStaffAccounts()).filter((s) => s.username === username);
    expect(after).toHaveLength(1);
    expect(after[0].role).toBe("analyst");
    const groups = (await admin.send(new sdk.AdminListGroupsForUserCommand({ UserPoolId: poolId, Username: username }))) as { Groups?: { GroupName?: string }[] };
    expect((groups.Groups ?? []).map((g) => g.GroupName)).toEqual(["platform-analyst"]);
  }, 60_000);

  it("a password reset forces a new password but keeps the authenticator", async () => {
    expect(await staff.resetStaffPassword(username!, { deliver: false, temporaryPassword: temp })).toEqual({ ok: true });
    const r = await staff.staffSignIn(email, temp);
    expect(r).toMatchObject({ kind: "challenge", challenge: { step: "new_password" } });
    if (r.kind !== "challenge") return;
    const next = await staff.staffSetNewPassword({ ...r.challenge, expiresAt: 0 }, password2);
    expect(next).toMatchObject({ kind: "challenge", challenge: { step: "mfa" } });
    if (next.kind !== "challenge") return;
    const done = await staff.staffVerifyMfa({ ...next.challenge, expiresAt: 0 }, await freshCode());
    expect(done).toMatchObject({ kind: "signed_in", identity: { role: "analyst" } });
  }, 120_000);

  it("a disabled account can't sign in, and gets the same answer as a wrong password", async () => {
    expect(await staff.setStaffEnabled(username!, false)).toEqual({ ok: true });
    expect(await staff.staffSignIn(email, password2)).toMatchObject({ kind: "failed", failure: { kind: "invalid_credentials" } });
    expect((await staff.listStaffAccounts()).find((s) => s.username === username)?.enabled).toBe(false);
    expect(await staff.setStaffEnabled(username!, true)).toEqual({ ok: true });
  }, 60_000);

  it("removes the account", async () => {
    expect(await staff.deleteStaff(username!)).toEqual({ ok: true });
    expect((await staff.listStaffAccounts()).find((s) => s.username === username)).toBeUndefined();
  }, 60_000);
});
