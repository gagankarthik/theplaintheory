import { SignJWT, jwtVerify } from "jose";
import { open, seal } from "./secret-box";
import { sessionSecret } from "./token";

/**
 * Short-lived, signed cookies that carry a sign-up or password reset between pages, so the code
 * page knows which address it's for without putting the e-mail in the URL.
 *
 * The sign-up cookie can also carry the password the person just typed, sealed with AES-256-GCM
 * (secret-box.ts), so that confirming the e-mail signs them straight in (Cognito InitiateAuth)
 * instead of asking for the password again. It's httpOnly, lives 30 minutes at most and is deleted as
 * soon as it's used. No next/headers here, so the token logic is unit-tested.
 */
export const SIGNUP_COOKIE = "pt_signup";
export const RESET_COOKIE = "pt_reset";
export const PENDING_SECONDS = 30 * 60;
/** Minimum gap between code e-mails for one sign-up or reset. */
export const RESEND_COOLDOWN_MS = 45_000;

export interface PendingSignup {
  email: string;
  name?: string;
  /** plain text after reading; sealed inside the token */
  password?: string;
  /** a plan picked on the pricing page, carried to onboarding */
  plan?: string;
  /** where to go after sign-in (an /app path) when this started at the sign-in form */
  next?: string;
  /** when the last code was sent, epoch ms */
  sentAt: number;
}

export interface PendingReset {
  email: string;
  sentAt: number;
}

export async function signPendingSignup(p: PendingSignup) {
  return new SignJWT({ typ: "signup", email: p.email, name: p.name, pw: p.password ? seal(p.password) : undefined, plan: p.plan, next: p.next, sentAt: p.sentAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_SECONDS}s`)
    .sign(sessionSecret());
}

export async function readPendingSignup(token: string | undefined): Promise<PendingSignup | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.typ !== "signup" || typeof payload.email !== "string" || typeof payload.sentAt !== "number") return null;
    let password: string | undefined;
    if (typeof payload.pw === "string") {
      try {
        password = open(payload.pw);
      } catch {
        password = undefined; // key rotated: they'll sign in by hand after confirming
      }
    }
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    return { email: payload.email, name: str(payload.name), password, plan: str(payload.plan), next: str(payload.next), sentAt: payload.sentAt };
  } catch {
    return null;
  }
}

export async function signPendingReset(p: PendingReset) {
  return new SignJWT({ typ: "reset", email: p.email, sentAt: p.sentAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_SECONDS}s`)
    .sign(sessionSecret());
}

export async function readPendingReset(token: string | undefined): Promise<PendingReset | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.typ !== "reset" || typeof payload.email !== "string" || typeof payload.sentAt !== "number") return null;
    return { email: payload.email, sentAt: payload.sentAt };
  } catch {
    return null;
  }
}

/** When the next code may be sent (epoch ms). */
export const resendAvailableAt = (sentAt: number | undefined) => (sentAt ? sentAt + RESEND_COOLDOWN_MS : 0);

export function pendingCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: PENDING_SECONDS };
}
