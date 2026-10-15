// Seeds the LOCAL file store (.data/) with a demo organization so you can sign in and see populated
// dashboard pages. Idempotent: a second run changes nothing. `--reset` removes only the demo data
// and seeds it again. Never touches DynamoDB or Cognito.
//
//   npm run seed:dev            seed (or report what exists)
//   npm run seed:dev -- --reset rebuild the demo organization
//   npm run dev:local           start the app on the local store to see it
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reset = process.argv.includes("--reset");

function refuse(message) {
  console.error(`seed:dev refused: ${message}`);
  process.exit(1);
}

// --- safety: this only ever writes the local file store ---
if (process.env.STORE_DRIVER === "dynamodb") refuse("STORE_DRIVER=dynamodb is set in this shell. The seed only writes the local file store; unset it.");
if (process.env.AUTH_DRIVER === "cognito") refuse("AUTH_DRIVER=cognito is set in this shell. The seed creates local password users; unset it.");
if (process.env.NODE_ENV === "production") refuse("NODE_ENV=production. The dev seed never runs in production.");
if (process.env.VERCEL) refuse("VERCEL is set. The dev seed never runs on Vercel.");

// .env.local is deliberately not loaded. Read it only to tell the developer how to see the data.
let envLocalUsesDynamo = false;
try {
  const text = readFileSync(path.join(root, ".env.local"), "utf8");
  envLocalUsesDynamo = /^\s*STORE_DRIVER\s*=\s*["']?dynamodb["']?\s*$/m.test(text);
} catch {
  // no .env.local
}

process.chdir(root);
const dataDir = process.env.LOCAL_DATA_DIR ? path.resolve(process.env.LOCAL_DATA_DIR) : path.join(root, ".data");
process.env.LOCAL_DATA_DIR = dataDir;
process.env.NODE_ENV ??= "development";

const credentialsPath = path.join(root, ".data", "dev-credentials.json");
const bundleDir = path.join(root, ".data", ".seed");
const bundleFile = path.join(bundleDir, "seed-dev-data.mjs");
mkdirSync(bundleDir, { recursive: true });

// Bundle the TypeScript seed with the app's own modules ("@/..." paths, extensionless imports).
await build({
  entryPoints: [path.join(root, "scripts", "seed-dev-data.ts")],
  outfile: bundleFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  alias: { "@": path.join(root, "src") },
  logLevel: "warning",
  plugins: [
    {
      name: "server-only-stub",
      setup(b) {
        b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export {};", loader: "js" }));
      },
    },
  ],
});

let result;
try {
  const mod = await import(pathToFileURL(bundleFile).href);
  result = await mod.seedDev({ reset, credentialsExist: existsSync(credentialsPath) });
} finally {
  rmSync(bundleDir, { recursive: true, force: true });
}

if (result.password) {
  mkdirSync(path.dirname(credentialsPath), { recursive: true });
  const creds = {
    email: result.email,
    password: result.password,
    url: "http://localhost:3000/login",
    note: "Local dev only (STORE_DRIVER=local, AUTH_DRIVER=local). Start the app with `npm run dev:local`. Regenerate with `npm run seed:dev -- --reset`.",
  };
  writeFileSync(credentialsPath, `${JSON.stringify(creds, null, 2)}\n`, { mode: 0o600 });
}

console.log(result.status === "created" ? "Demo data seeded." : "Demo data already exists; nothing duplicated.");
for (const line of result.summary) console.log(line);
console.log("");
console.log(`Sign in as:   ${result.email}`);
console.log(`Password in:  ${path.relative(root, credentialsPath)}`);
if (dataDir !== path.join(root, ".data")) console.log(`Data dir:     ${dataDir} (from LOCAL_DATA_DIR)`);
if (envLocalUsesDynamo) console.log("Note: your .env.local uses DynamoDB; start the app with npm run dev:local to see this data.");
