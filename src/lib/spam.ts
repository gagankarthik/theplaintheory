/**
 * Lightweight content checks for public forms. Deliberately small and inline: no external lists or
 * services. They catch the bulk of automated junk; the honeypot, time trap and rate limits do the rest.
 */

/** Common throwaway inbox providers. Subdomains match too (e.g. x.mailinator.com). */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "33mail.com",
  "burnermail.io",
  "discard.email",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamailblock.com",
  "grr.la",
  "inboxkitten.com",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "moakt.com",
  "sharklasers.com",
  "spamgourmet.com",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "tempmailo.com",
  "tempr.email",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "1secmail.com",
]);

export function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase().replace(/\.$/, "");
}

export function isDisposableEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return false;
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(i).join("."))) return true;
  }
  return false;
}

export const DISPOSABLE_EMAIL_MESSAGE = "Use a permanent email address. We can't reply to temporary inboxes.";

const LINK = /\bhttps?:\/\/|\bwww\.|\[url=|<a\s/gi;

export function countLinks(text: string) {
  return (text.match(LINK) ?? []).length;
}

/** true when text holds any link at all (names and company fields shouldn't) */
export const hasLink = (text: string) => countLinks(text) > 0;

export const MAX_LINKS = 3;

/** Phrases that almost only appear in unsolicited marketing and scam messages. */
const SPAM_MARKERS: RegExp[] = [
  /\b(viagra|cialis|casino|porn|escort service)/i,
  /\b(payday|instant) loans?\b/i,
  /\bforex (signals?|trading)\b/i,
  /\b(crypto(currency)?|bitcoin) (investment|profits?|opportunity)\b/i,
  /\bguaranteed (returns?|profits?|ranking)\b/i,
  /\b(seo|link building|backlinks?|guest post(ing)?) (services?|packages?|offers?)\b/i,
  /\bbuy (cheap )?(backlinks|followers|likes|reviews)\b/i,
  /\bfirst page (of|on) google\b/i,
  /\b(rank|ranking) (your|you) (site|website) (on|at) (the )?top\b/i,
  /\bwork from home and earn\b/i,
  /\b(whatsapp|telegram) me\b/i,
  /\bunsubscribe\b/i,
];

export function hasSpamMarkers(text: string) {
  return SPAM_MARKERS.some((re) => re.test(text));
}
