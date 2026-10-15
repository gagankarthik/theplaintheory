// `next dev` against the local file store and local password auth, whatever .env.local says.
// Real environment variables win over .env.local in Next, so these overrides hold.
//
//   npm run dev:local            port 3000
//   npm run dev:local -- -p 3100 any `next dev` arguments pass through
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const env = {
  ...process.env,
  STORE_DRIVER: "local",
  AUTH_DRIVER: "local",
  PUBLISH_DRIVER: "local",
  // empty values also shadow .env.local: no SQS crawler queue or real email from a local run
  CRAWLER_QUEUE_URL: "",
  MAIL_FROM: "",
};

console.log("Starting next dev with STORE_DRIVER=local AUTH_DRIVER=local PUBLISH_DRIVER=local (data in .data/)");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" });

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
