// Builds sdk/src -> public/sdk/plain-consent.js and enforces the 10 KB gzip budget (PRD FR-3.1).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET = 10 * 1024;
const outfile = "public/sdk/plain-consent.js";

await build({
  entryPoints: ["sdk/src/index.ts"],
  outfile,
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  legalComments: "none",
  banner: { js: "/*! plain-consent.js | The Plain Theory | theplaintheory.com */" },
});

const code = readFileSync(outfile);
const gz = gzipSync(code, { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(2) + " KB";
console.log(`plain-consent.js  raw ${kb(code.length)}  gzip ${kb(gz)}  (budget ${kb(BUDGET)})`);
if (gz > BUDGET) {
  console.error("SDK is over the 10 KB gzip budget. Trim it before shipping.");
  process.exit(1);
}

// The marketing site and docs read this, so the published size is never stale.
const oneDecimal = (n) => (Math.round((n / 1024) * 10) / 10).toFixed(1);
writeFileSync(
  "public/sdk/size.json",
  `${JSON.stringify({ rawBytes: code.length, gzipBytes: gz, gzipKb: oneDecimal(gz), budgetKb: BUDGET / 1024, builtAt: new Date().toISOString() }, null, 2)}\n`,
);
