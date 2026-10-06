import type { Cats, PublicConfig, Stored } from "./types";

/** First-party consent record: cookie (readable server-side) mirrored to localStorage. */
const KEY = "plain_consent";

export function randomId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function readStored(): Stored | null {
  try {
    const m = document.cookie.match(/(?:^|; )plain_consent=([^;]*)/);
    const raw = m ? decodeURIComponent(m[1]) : localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Pass null to clear. Storage can be blocked; consent then holds for this page view only. */
export function writeStored(s: Stored | null, expiryDays = 180): void {
  const secure = location.protocol === "https:" ? ";Secure" : "";
  try {
    if (!s) {
      document.cookie = `${KEY}=;Max-Age=0;Path=/;SameSite=Lax${secure}`;
      localStorage.removeItem(KEY);
      return;
    }
    const v = JSON.stringify(s);
    document.cookie = `${KEY}=${encodeURIComponent(v)};Max-Age=${Math.round(expiryDays * 86400)};Path=/;SameSite=Lax${secure}`;
    localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable */
  }
}

/**
 * A stored choice is valid only for the same config version and within its window.
 *
 * Re-ask suppression: after "reject all" the window is `cfg.reask` days (default 180) instead of the
 * consent expiry, so a visitor who declined isn't asked again on every visit. A new published config
 * version still re-asks, because the purposes or vendors shown may have materially changed; publish
 * only for material changes. Withdrawal and changes are always available from Privacy choices.
 */
export function isFresh(s: Stored | null, cfg: PublicConfig, now = Date.now()): s is Stored {
  if (!s || s.v !== cfg.version) return false;
  const days = s.r ? (cfg.reask ?? 180) : cfg.expiryDays;
  return now - (s.r ?? s.t) < days * 86400000;
}

export const NONE: Cats = { essential: true, functional: false, analytics: false, marketing: false };
export const ALL: Cats = { essential: true, functional: true, analytics: true, marketing: true };
