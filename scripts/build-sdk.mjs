// Builds sdk/src -> public/sdk/plain-consent.js and reports its size. There is no size limit: the product owner
// chose working behaviour over a byte budget, so size never fails the build.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const outfile = "public/sdk/plain-consent.js";

await build({
  entryPoints: ["sdk/src/index.ts"],
  outfile,
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  legalComments: "none",
  banner: { js: "/*! plain-consent.js | The Plain Theory | theplaintheory.in */" },
});

const code = readFileSync(outfile);
const gz = gzipSync(code, { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(2) + " KB";
console.log(`plain-consent.js  raw ${kb(code.length)}  gzip ${kb(gz)}`);

// A build record for engineering; nothing customer-facing reads it.
const oneDecimal = (n) => (Math.round((n / 1024) * 10) / 10).toFixed(1);
writeFileSync(
  "public/sdk/size.json",
  `${JSON.stringify({ rawBytes: code.length, gzipBytes: gz, gzipKb: oneDecimal(gz), builtAt: new Date().toISOString() }, null, 2)}\n`,
);
