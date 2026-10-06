/**
 * Password policy (SOC 2 CC6.1, NIST SP 800-63B §5.1.1.2): length over complexity theatre, and a
 * block on passwords that appear in breach corpora or contain the account's own email name.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/** Most common base words in public breach lists. Matched after stripping leading/trailing digits and symbols. */
const COMMON = new Set([
  "password", "passw0rd", "p@ssword", "p@ssw0rd", "qwerty", "qwertyuiop", "qwertyuiop[]", "asdfghjkl", "zxcvbnm", "letmein",
  "welcome", "iloveyou", "admin", "administrator", "monkey", "dragon", "football", "baseball", "sunshine", "princess",
  "shadow", "master", "superman", "batman", "trustno", "starwars", "whatever", "freedom", "abc", "abcdef", "abcdefgh",
  "abcdefghijk", "secret", "changeme", "default", "login", "hello", "charlie", "michael", "jennifer", "computer",
  "internet", "india", "bharat", "mumbai", "delhi", "bangalore", "cricket", "sachin", "krishna", "ganesh", "saibaba",
  "plaintheory", "consent", "cookie", "cookies", "privacy", "company", "summer", "winter", "spring", "autumn",
  "january", "february", "march", "october", "november", "december", "monday", "friday", "test", "testing", "demo",
  "guest", "user", "root", "access", "pass", "pa55word", "mypassword", "newpassword", "password1", "qazwsx",
  "qazwsxedc", "1qaz2wsx", "zaq12wsx", "aaaaaa", "aaaaaaaa", "asdf", "asdfgh", "q1w2e3r4", "1q2w3e4r", "q1w2e3r4t5",
]);

/** Sequences and repeats that look long but are trivial to guess. */
const SEQUENCES = ["0123456789", "1234567890", "9876543210", "abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm"];

export function checkPassword(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password)) return "Don't repeat one character.";
  if (SEQUENCES.some((seq) => seq.includes(lower))) return "Avoid simple sequences like 1234 or abcd.";
  const core = lower.replace(/^[^a-z]+|[^a-z]+$/g, "");
  if (COMMON.has(lower) || COMMON.has(core)) return "That password is too common. Pick something only you would use.";
  const local = email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (local && local.length >= 4 && lower.replace(/[^a-z0-9]/g, "").includes(local)) return "Don't include your email name in your password.";
  return null;
}
