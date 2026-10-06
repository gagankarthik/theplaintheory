import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The shipped consent script's size, so marketing copy never drifts from the real bundle.
 *
 * Source of truth is public/sdk/size.json, written by the SDK build as
 * { rawBytes, gzipBytes, gzipKb, budgetKb, builtAt }. Reads `gzipKb`, else derives it from
 * `gzipBytes`, else gzips the built bundle, else falls back to a conservative "8".
 * Synchronous and cached for the life of the process (server-only).
 */
interface SizeFile {
  rawBytes?: number;
  gzipBytes?: number;
  gzipKb?: number | string;
  budgetKb?: number;
  builtAt?: string;
}

const FALLBACK_KB = "8";
let cached: string | null = null;

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function read(): string {
  const dir = path.join(process.cwd(), "public", "sdk");
  try {
    const json = JSON.parse(readFileSync(path.join(dir, "size.json"), "utf8")) as SizeFile;
    if (json.gzipKb !== undefined && Number.isFinite(Number(json.gzipKb))) return oneDecimal(Number(json.gzipKb));
    if (typeof json.gzipBytes === "number") return oneDecimal(json.gzipBytes / 1024);
  } catch {
    /* no size.json yet: fall through */
  }
  try {
    return oneDecimal(gzipSync(readFileSync(path.join(dir, "plain-consent.js")), { level: 9 }).length / 1024);
  } catch {
    return FALLBACK_KB;
  }
}

/** Gzipped size in KB as a plain one-decimal number, e.g. "7.7". */
export function sdkSizeKb(): string {
  cached ??= read();
  return cached;
}

/** e.g. "7.7 KB" */
export function sdkSizeLabel(): string {
  return `${sdkSizeKb()} KB`;
}
