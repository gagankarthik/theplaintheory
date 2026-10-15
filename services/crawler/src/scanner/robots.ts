import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { guardedLookup } from "../net-guard";

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

const MAX_ROBOTS_BYTES = 500_000;
const MAX_ROBOTS_REDIRECTS = 5;

export interface RobotsFetchOptions {
  /** Decides whether each hop may be fetched (net-guard isAllowedUrl in the worker). Omitted = allow all. */
  guard?: (url: string) => Promise<boolean>;
  timeoutMs?: number;
}

interface RobotsResponse {
  status: number;
  location: string | null;
  contentType: string;
  body: string;
}

/** One GET with no redirect handling, connecting through guardedLookup when a guard is in force. */
function getOnce(url: URL, userAgent: string, guarded: boolean, signal: AbortSignal): Promise<RobotsResponse> {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", headers: { "user-agent": userAgent, accept: "text/plain,*/*;q=0.1" }, signal, ...(guarded ? { lookup: guardedLookup } : {}) }, (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;
      const contentType = res.headers["content-type"] ?? "";
      if (status < 200 || status >= 300) {
        res.resume();
        resolve({ status, location, contentType, body: "" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        if (size >= MAX_ROBOTS_BYTES) return;
        chunks.push(chunk);
        size += chunk.length;
        if (size >= MAX_ROBOTS_BYTES) res.destroy();
      });
      const done = () => resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf8").slice(0, MAX_ROBOTS_BYTES) });
      res.on("end", done);
      res.on("close", done);
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetches /robots.txt for the origin. Missing, unreachable, refused or 4xx robots files allow everything.
 * Redirects are followed by hand (at most 5) so the guard sees every hop: a public robots.txt that
 * redirects to 169.254.169.254 is refused, never fetched.
 */
export async function fetchRobots(startUrl: string, userAgent: string, opts: RobotsFetchOptions = {}): Promise<RobotsPolicy> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 5000);
  try {
    let url = new URL("/robots.txt", startUrl);
    for (let hop = 0; hop <= MAX_ROBOTS_REDIRECTS; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") return ALLOW_ALL;
      if (opts.guard && !(await opts.guard(url.toString()))) return ALLOW_ALL;
      const res = await getOnce(url, userAgent, Boolean(opts.guard), signal);
      if (res.status >= 300 && res.status < 400) {
        if (!res.location) return ALLOW_ALL;
        url = new URL(res.location, url);
        continue;
      }
      if (res.status < 200 || res.status >= 300) return ALLOW_ALL;
      if (res.contentType && !res.contentType.includes("text/")) return ALLOW_ALL;
      return parseRobots(res.body);
    }
    return ALLOW_ALL;
  } catch {
    return ALLOW_ALL;
  }
}
