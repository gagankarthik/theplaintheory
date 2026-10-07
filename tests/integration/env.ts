import { readFileSync } from "node:fs";
import path from "node:path";

/** .env.local as key/value pairs (never printed). Integration tests copy only the keys they need. */
export function loadEnvLocal() {
  let raw = "";
  try {
    raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return {} as Record<string, string>;
  }
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}
