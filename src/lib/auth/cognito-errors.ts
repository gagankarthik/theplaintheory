/**
 * Pure helpers for the Cognito sign-in provider: error classification, the pool's password
 * composition rule and e-mail masking. No SDK, no request, so they're unit-tested.
 *
 * Messages follow the app's wording: say what happened and what to do next, and never confirm or
 * deny that an account exists unless the person has already proved they know its password.
 */

export const INVALID_CREDENTIALS = "That email and password don't match an account.";
export const ACCOUNT_EXISTS = "An account with this email already exists. Sign in instead.";
export const CODE_MISMATCH = "That code didn't match. Check the newest email from us and try again.";
export const CODE_EXPIRED = "That code has expired. Send a new code and use the newest one.";
export const THROTTLED = "Too many attempts. Wait a few minutes and try again.";
export const COGNITO_PASSWORD_RULE = "Use at least 12 characters, including a lowercase letter, a number and a symbol.";

export type CognitoOp = "signUp" | "confirmSignUp" | "resendCode" | "signIn" | "forgotPassword" | "confirmForgotPassword" | "changePassword" | "admin";

export type CognitoFailureKind =
  /** wrong email or password, or no such user (never distinguished) */
  | "invalid_credentials"
  /** right password, e-mail not confirmed yet */
  | "unconfirmed"
  /** an administrator required a password reset */
  | "reset_required"
  | "exists"
  | "password_policy"
  | "code_mismatch"
  | "code_expired"
  | "already_confirmed"
  | "throttled"
  | "delivery_failed"
  | "unavailable";

export interface CognitoFailure {
  kind: CognitoFailureKind;
  message: string;
  /** the SDK exception name, for logs only (never shown) */
  name: string;
}

export function cognitoErrorName(e: unknown): string {
  if (e && typeof e === "object") {
    const n = (e as { name?: unknown; __type?: unknown }).name ?? (e as { __type?: unknown }).__type;
    if (typeof n === "string" && n) return n.includes("#") ? n.split("#").pop()! : n;
  }
  return "UnknownError";
}

const errorMessage = (e: unknown) => (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : "");

const UNAVAILABLE: Record<CognitoOp, string> = {
  signUp: "We couldn't create your account right now. Try again in a minute.",
  confirmSignUp: "We couldn't check that code right now. Try again in a minute.",
  resendCode: "We couldn't send a new code right now. Try again in a minute.",
  signIn: "Sign-in is unavailable right now. Try again in a minute.",
  forgotPassword: "We couldn't start a password reset right now. Try again in a minute.",
  confirmForgotPassword: "We couldn't reset your password right now. Try again in a minute.",
  changePassword: "We couldn't change your password right now. Try again in a minute.",
  admin: "The sign-in provider didn't respond. Try again in a minute.",
};

/** Map a Cognito SDK exception to a kind the app acts on and a message it can show. */
export function classifyCognitoError(e: unknown, op: CognitoOp): CognitoFailure {
  const name = cognitoErrorName(e);
  const msg = errorMessage(e);
  const out = (kind: CognitoFailureKind, message: string): CognitoFailure => ({ kind, message, name });
  const codeOp = op === "confirmSignUp" || op === "confirmForgotPassword";

  switch (name) {
    case "UsernameExistsException":
    case "AliasExistsException":
      return out("exists", ACCOUNT_EXISTS);
    case "InvalidPasswordException":
      return out("password_policy", COGNITO_PASSWORD_RULE);
    case "PasswordHistoryPolicyViolationException":
      return out("password_policy", "Choose a password you haven't used here before.");
    case "UserNotConfirmedException":
      return out("unconfirmed", "Confirm your email to finish signing up. We sent you a new code.");
    case "PasswordResetRequiredException":
      return out("reset_required", "Reset your password to continue. Use Forgot password to get a code by email.");
    case "CodeMismatchException":
      return out("code_mismatch", CODE_MISMATCH);
    case "ExpiredCodeException":
      return out("code_expired", CODE_EXPIRED);
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return out("throttled", THROTTLED);
    case "CodeDeliveryFailureException":
      return out("delivery_failed", "We couldn't send the email with your code. Try again in a minute.");
    case "UserNotFoundException":
      // With user-existence errors prevented this is rare; never reveal it either way.
      return codeOp ? out("code_mismatch", CODE_MISMATCH) : out("invalid_credentials", INVALID_CREDENTIALS);
    case "NotAuthorizedException":
      if (/attempts exceeded/i.test(msg)) return out("throttled", THROTTLED);
      if (op === "confirmSignUp" && /CONFIRMED/.test(msg)) return out("already_confirmed", "Your email is already confirmed. Sign in to continue.");
      if (op === "signIn" || op === "changePassword") return out("invalid_credentials", INVALID_CREDENTIALS);
      return codeOp ? out("code_mismatch", CODE_MISMATCH) : out("unavailable", UNAVAILABLE[op]);
    case "InvalidParameterException":
      // e.g. "no registered/verified email" on a reset, or "already confirmed" on a resend.
      if (op === "confirmSignUp" && /CONFIRMED/i.test(msg)) return out("already_confirmed", "Your email is already confirmed. Sign in to continue.");
      if (codeOp) return out("code_mismatch", CODE_MISMATCH);
      if (op === "signIn") return out("invalid_credentials", INVALID_CREDENTIALS);
      return out("unavailable", UNAVAILABLE[op]);
    default:
      return out("unavailable", UNAVAILABLE[op]);
  }
}

/** Characters Cognito counts as symbols (its password policy documentation). */
const SYMBOLS = new Set(`^$*.[]{}()?"!@#%&/\\,><':;|_~\`=+-`);

/**
 * The user pool's composition rule on top of the app policy (password-policy.ts): a lowercase
 * letter, a number and a symbol, and no leading or trailing whitespace (Cognito rejects those).
 * Checked before calling Cognito so the person sees which part is missing, inline.
 */
export function cognitoPasswordProblem(password: string): string | null {
  if (/^\s|\s$/.test(password)) return "Remove spaces from the start and end of your password.";
  if (!/[a-z]/.test(password)) return "Include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  if (![...password].some((c) => SYMBOLS.has(c))) return "Include at least one symbol, such as ! # - or _.";
  return null;
}

/** g•••n@example.com: enough to recognise your own address, not enough to harvest one. */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.length <= 2 ? `${local[0] ?? ""}•••` : `${local[0]}•••${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}
