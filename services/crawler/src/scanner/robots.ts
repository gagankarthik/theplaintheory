/**
 * Minimal robots.txt support: groups for our product token and "*", Allow/Disallow with `*` and `$`
 * wildcards, longest-match precedence (Allow wins ties), per RFC 9309.
 */

interface RobotsRule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

export interface RobotsPolicy {
  isAllowed(url: string): boolean;
  rules: RobotsRule[];
}

export const ROBOTS_PRODUCT_TOKEN = "cmpscanner";

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function parseRobots(text: string, productToken = ROBOTS_PRODUCT_TOKEN): RobotsPolicy {
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow means "allow everything" and contributes no rule.
      if (!value) continue;
      current.rules.push({ allow: key === "allow", pattern: value, regex: toRegex(value) });
    }
  }

  const token = productToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);

  return {
    rules,
    isAllowed(url: string): boolean {
      let path: string;
      try {
        const u = new URL(url);
        path = `${u.pathname}${u.search}`;
      } catch {
        return false;
      }
      let best: RobotsRule | null = null;
      for (const rule of rules) {
        if (!rule.regex.test(path)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
        ) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

export const ALLOW_ALL: RobotsPolicy = { rules: [], isAllowed: () => true };

/** Fetches /robots.txt for the origin. Missing, unreachable or 4xx robots files allow everything. */
export async function fetchRobots(startUrl: string, userAgent: string, timeoutMs = 5000): Promise<RobotsPolicy> {
  try {
    const robotsUrl = new URL("/robots.txt", startUrl).toString();
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": userAgent },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return ALLOW_ALL;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.includes("text/plain") && !type.includes("text/")) return ALLOW_ALL;
    const text = await res.text();
    return parseRobots(text.slice(0, 500_000));
  } catch {
    return ALLOW_ALL;
  }
}
