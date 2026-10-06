import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { KNOWN_TRACKERS } from "./defaults";
import type { Tracker } from "./types";

/**
 * Lightweight tracker scanner (Phase 2 runs this in a scheduled Lambda with a headless browser).
 * Fetches the homepage HTML and matches script sources and inline snippets against known trackers.
 */

function isPrivate(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export type ScanResult =
  | { ok: true; url: string; scripts: number; found: (Omit<Tracker, "id"> & { evidence: string })[] }
  | { ok: false; error: string };

async function assertPublicHost(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https addresses can be scanned.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only standard web ports (80 and 443) can be scanned.");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local and internal addresses can't be scanned. Use your public domain.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) {
    throw new Error("That domain points to a private network address, so it can't be scanned.");
  }
}

export async function scanDomain(domain: string): Promise<ScanResult> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//.test(domain) ? domain : `https://${domain}`);
  } catch {
    return { ok: false, error: "That domain isn't a valid web address." };
  }

  try {
    let html = "";
    // Follow up to 3 redirects manually so every hop is checked against the private-network rule.
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicHost(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "PlainTheoryScanner/1.0 (+https://theplaintheory.com/scanner)", accept: "text/html" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (!res.ok) return { ok: false, error: `The site answered with HTTP ${res.status}. Check the domain is live and public.` };
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
        if (size > 3_000_000) break;
      }
      html = new TextDecoder().decode(Buffer.concat(chunks));
      break;
    }

    const srcs = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
    const found = new Map<string, Omit<Tracker, "id"> & { evidence: string }>();
    for (const t of KNOWN_TRACKERS) {
      const hit = srcs.find((s) => s.includes(t.pattern)) ?? (inline.includes(t.pattern) ? "inline script" : undefined);
      if (hit) found.set(t.pattern, { ...t, evidence: hit.slice(0, 140) });
    }
    return { ok: true, url: url.toString(), scripts: srcs.length, found: [...found.values()] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort|timeout/i.test(msg)) return { ok: false, error: "The site took longer than 8 seconds to respond." };
    if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return { ok: false, error: "That domain doesn't resolve. Check the spelling." };
    return { ok: false, error: msg };
  }
}
