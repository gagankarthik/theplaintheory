#!/usr/bin/env node
/**
 * Design-review screenshots via the Chrome DevTools Protocol (no dependencies).
 *
 *   node scripts/shot.mjs <path> <out.png> [width=1440] [height=900] [--full] [--mobile] [--as=<email>]
 *
 * --as registers a session record in the local dev store for that existing user and signs its cookie
 * with the dev secret, to capture signed-in pages. Refuses to run against production or DynamoDB.
 *
 * Emulates the exact viewport (headless window sizing has a minimum width), waits for fonts and
 * animations, and optionally captures the full page height. Not part of the build.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [, , route = "/", out = "shot.png", w = "1440", h = "900", ...flags] = process.argv;
const full = flags.includes("--full");
const mobile = flags.includes("--mobile");
const asUser = flags.find((f) => f.startsWith("--as="))?.slice(5);
const evalExpr = flags.find((f) => f.startsWith("--eval="))?.slice(7);
/** --inject=<file>: run a local script (e.g. node_modules/axe-core/axe.min.js) in the page before --eval; bypasses CSP. */
const injectFile = flags.find((f) => f.startsWith("--inject="))?.slice(9);
const dpr = Number(flags.find((f) => f.startsWith("--dpr="))?.slice(6) ?? 1);
const base = process.env.SHOT_BASE ?? "http://localhost:3000";
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9300 + Math.floor(Math.random() * 500);

const proc = spawn(
  chrome,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "shot-"))}`, "about:blank"],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWs() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await targetWs());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

try {
  const width = Number(w);
  const height = Number(h);
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.enable");
  if (asUser) {
    // Dev only: register a real server-side session record (the app rejects tokens without one),
    // then sign the matching cookie with the dev secret.
    if (process.env.NODE_ENV === "production" || process.env.STORE_DRIVER === "dynamodb") throw new Error("--as only works against the local dev store");
    const { SignJWT } = await import("jose");
    const { readFileSync, renameSync } = await import("node:fs");
    const { randomBytes } = await import("node:crypto");
    const db = JSON.parse(readFileSync(".data/db.json", "utf8"));
    const user = db.users.find((u) => u.email === asUser);
    if (!user) throw new Error(`No local user ${asUser}. Sign up first.`);
    const now = Date.now();
    const abs = Math.floor(now / 1000) + 12 * 3600;
    const sid = `ses_${randomBytes(24).toString("base64url")}`;
    (db.sessions ??= []).push({
      id: sid,
      userId: user.id,
      createdAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: new Date(abs * 1000).toISOString(),
      ipHash: "screenshot",
      userAgent: "system",
      mfaVerified: Boolean(user.mfa),
    });
    writeFileSync(".data/db.json.shot", JSON.stringify(db, null, 2));
    renameSync(".data/db.json.shot", ".data/db.json");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-secret-change-me-dev-only-secret");
    const token = await new SignJWT({ sid, userId: user.id, email: user.email, abs, typ: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(secret);
    await send("Network.enable");
    await send("Network.setCookie", { name: "pt_session", value: token, url: base });
  }
  await send("Page.navigate", { url: base + (route.startsWith("/") ? route : `/${route}`) });
  await sleep(3500);
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true });
  const overflow = await send("Runtime.evaluate", {
    expression: "document.documentElement.scrollWidth - document.documentElement.clientWidth",
    returnByValue: true,
  });
  if (overflow.result.value > 0) console.warn(`horizontal overflow: ${overflow.result.value}px`);
  if (injectFile) await send("Runtime.evaluate", { expression: readFileSync(injectFile, "utf8") });
  if (evalExpr) {
    const r = await send("Runtime.evaluate", { expression: evalExpr, returnByValue: true, awaitPromise: true });
    console.log("eval:", JSON.stringify(r.result.value ?? r.exceptionDetails?.text));
  }

  let clip;
  if (full) {
    const { contentSize } = await send("Page.getLayoutMetrics");
    // Keep the real viewport (so vh-based layouts stay true) and capture beyond it.
    const fullHeight = Math.min(Math.ceil(contentSize.height), 16000);
    clip = { x: 0, y: 0, width, height: fullHeight, scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  writeFileSync(out, Buffer.from(data, "base64"));
  console.log(out);
} finally {
  ws.close();
  proc.kill();
}
