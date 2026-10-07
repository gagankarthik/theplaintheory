import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EXISTS,
  CODE_EXPIRED,
  CODE_MISMATCH,
  COGNITO_PASSWORD_RULE,
  INVALID_CREDENTIALS,
  THROTTLED,
  classifyCognitoError,
  cognitoErrorName,
  cognitoPasswordProblem,
  maskEmail,
  type CognitoOp,
} from "@/lib/auth/cognito-errors";
import { RESEND_COOLDOWN_MS, readPendingReset, readPendingSignup, resendAvailableAt, signPendingReset, signPendingSignup } from "@/lib/auth/pending";
import { checkPassword } from "@/lib/auth/password-policy";

const err = (name: string, message = "") => Object.assign(new Error(message), { name });

describe("cognitoErrorName", () => {
  it("reads the SDK exception name", () => {
    expect(cognitoErrorName(err("CodeMismatchException"))).toBe("CodeMismatchException");
  });
  it("strips the namespace from a raw __type", () => {
    expect(cognitoErrorName({ __type: "com.amazonaws.cognito#UserNotFoundException" })).toBe("UserNotFoundException");
  });
  it("falls back for non-errors", () => {
    expect(cognitoErrorName(null)).toBe("UnknownError");
    expect(cognitoErrorName("boom")).toBe("UnknownError");
  });
});

describe("classifyCognitoError", () => {
  const kind = (name: string, op: CognitoOp, message = "") => classifyCognitoError(err(name, message), op).kind;

  it("never tells a wrong password from an unknown user at sign-in", () => {
    const wrong = classifyCognitoError(err("NotAuthorizedException", "Incorrect username or password."), "signIn");
    const unknown = classifyCognitoError(err("UserNotFoundException", "User does not exist."), "signIn");
    expect(wrong).toEqual({ kind: "invalid_credentials", message: INVALID_CREDENTIALS, name: "NotAuthorizedException" });
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.kind).toBe("invalid_credentials");
  });

  it("treats Cognito's own attempt limit as throttling, not a wrong password", () => {
    expect(classifyCognitoError(err("NotAuthorizedException", "Password attempts exceeded"), "signIn")).toMatchObject({ kind: "throttled", message: THROTTLED });
  });

  it("maps the unconfirmed and reset-required states at sign-in", () => {
    expect(kind("UserNotConfirmedException", "signIn")).toBe("unconfirmed");
    expect(kind("PasswordResetRequiredException", "signIn")).toBe("reset_required");
  });

  it("maps sign-up conflicts and password rules", () => {
    expect(classifyCognitoError(err("UsernameExistsException"), "signUp")).toMatchObject({ kind: "exists", message: ACCOUNT_EXISTS });
    expect(classifyCognitoError(err("InvalidPasswordException", "Password did not conform with policy"), "signUp")).toMatchObject({
      kind: "password_policy",
      message: COGNITO_PASSWORD_RULE,
    });
    expect(kind("PasswordHistoryPolicyViolationException", "changePassword")).toBe("password_policy");
  });

  it.each(["confirmSignUp", "confirmForgotPassword"] as const)("keeps %s answers about the code, never the account", (op) => {
    expect(classifyCognitoError(err("CodeMismatchException"), op)).toMatchObject({ kind: "code_mismatch", message: CODE_MISMATCH });
    expect(classifyCognitoError(err("ExpiredCodeException"), op)).toMatchObject({ kind: "code_expired", message: CODE_EXPIRED });
    expect(classifyCognitoError(err("UserNotFoundException"), op).message).toBe(CODE_MISMATCH);
    expect(classifyCognitoError(err("InvalidParameterException", "Cannot reset password for the user as there is no registered/verified email"), op).kind).toBe(
      "code_mismatch",
    );
  });

  it("recognises an already confirmed account", () => {
    expect(kind("NotAuthorizedException", "confirmSignUp", "User cannot be confirmed. Current status is CONFIRMED")).toBe("already_confirmed");
  });

  it.each(["LimitExceededException", "TooManyRequestsException", "TooManyFailedAttemptsException"])("treats %s as throttling", (name) => {
    expect(kind(name, "confirmSignUp")).toBe("throttled");
  });

  it("reports delivery failures and unknown errors without internals", () => {
    expect(kind("CodeDeliveryFailureException", "signUp")).toBe("delivery_failed");
    const f = classifyCognitoError(err("InternalErrorException", "stack trace with secrets"), "signIn");
    expect(f.kind).toBe("unavailable");
    expect(f.message).not.toMatch(/stack|secret/);
    expect(classifyCognitoError(err("ResourceNotFoundException"), "forgotPassword").message).toMatch(/password reset/);
  });
});

describe("cognitoPasswordProblem", () => {
  it("accepts a password meeting the pool's rule", () => {
    expect(cognitoPasswordProblem("violet-harbour-47")).toBeNull();
  });
  it.each([
    ["no lowercase", "VIOLET-HARBOUR-47", /lowercase/],
    ["no number", "violet-harbour-lantern", /number/],
    ["no symbol", "violet harbour 47x", /symbol/],
    ["leading space", " violet-harbour-47", /spaces/],
    ["trailing space", "violet-harbour-47 ", /spaces/],
  ])("rejects %s", (_, pw, msg) => {
    expect(cognitoPasswordProblem(pw)).toMatch(msg);
  });
  it("adds to the app policy rather than replacing it", () => {
    // passes Cognito's composition rule, still refused by the app's breach list
    expect(cognitoPasswordProblem("password-1234")).toBeNull();
    expect(checkPassword("password-1234", "a@b.example")).not.toBeNull();
  });
});

describe("maskEmail", () => {
  it("keeps the first and last character and the domain", () => {
    expect(maskEmail("gagan@theplaintheory.in")).toBe("g•••n@theplaintheory.in");
  });
  it("handles very short local parts", () => {
    expect(maskEmail("ab@x.io")).toBe("a•••@x.io");
    expect(maskEmail("a@x.io")).toBe("a•••@x.io");
  });
  it("leaves non-addresses alone", () => {
    expect(maskEmail("nope")).toBe("nope");
  });
});

describe("pending sign-up and reset tokens", () => {
  it("round-trips a sign-up and keeps the password sealed inside the token", async () => {
    const token = await signPendingSignup({ email: "asha@acme.example", name: "Asha", password: "violet-harbour-47", plan: "growth", sentAt: 1_000 });
    const raw = decodeJwt(token);
    expect(JSON.stringify(raw)).not.toContain("violet-harbour-47");
    expect(String(raw.pw)).toMatch(/^v1:/);
    expect(await readPendingSignup(token)).toEqual({ email: "asha@acme.example", name: "Asha", password: "violet-harbour-47", plan: "growth", next: undefined, sentAt: 1_000 });
  });

  it("works without a password (resend from a fresh browser)", async () => {
    const r = await readPendingSignup(await signPendingSignup({ email: "asha@acme.example", sentAt: 5 }));
    expect(r?.password).toBeUndefined();
    expect(r?.email).toBe("asha@acme.example");
  });

  it("rejects tampered, missing and cross-purpose tokens", async () => {
    const token = await signPendingSignup({ email: "asha@acme.example", sentAt: 1 });
    expect(await readPendingSignup(token.slice(0, -2) + "xx")).toBeNull();
    expect(await readPendingSignup(undefined)).toBeNull();
    const reset = await signPendingReset({ email: "asha@acme.example", sentAt: 1 });
    expect(await readPendingSignup(reset)).toBeNull();
    expect(await readPendingReset(token)).toBeNull();
    expect(await readPendingReset(reset)).toEqual({ email: "asha@acme.example", sentAt: 1 });
  });

  it("spaces code e-mails by the cooldown", () => {
    expect(resendAvailableAt(10_000)).toBe(10_000 + RESEND_COOLDOWN_MS);
    expect(resendAvailableAt(undefined)).toBe(0);
    expect(RESEND_COOLDOWN_MS).toBeGreaterThanOrEqual(30_000);
    expect(RESEND_COOLDOWN_MS).toBeLessThanOrEqual(60_000);
  });
});
