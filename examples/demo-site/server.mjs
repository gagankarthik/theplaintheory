#!/usr/bin/env node
/**
 * Zero-dependency static server for the Halden & Rye demo storefront.
 *
 *   node examples/demo-site/server.mjs            # http://localhost:4000
 *   PORT=4100 node examples/demo-site/server.mjs
 *
 * Besides static files it:
 *  - sets first-party cookies on HTML responses (an HttpOnly session the crawler must find via CDP,
 *    a localisation cookie, and a cart cookie on /cart.html);
 *  - serves /sdk/plain-consent.js straight from the app's build (public/sdk, `npm run sdk:build`);
 *  - fills the snippet's data-site / data-api from PLAIN_SITE_KEY (the demo site's key from the
 *    dashboard's Install page) and PLAIN_API (default http://localhost:3000/api/v1).
 */
import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SDK_DIST = path.resolve(ROOT, "../../public/sdk");
const PORT = Number(process.env.PORT) || 4000;
const SITE_KEY = process.env.PLAIN_SITE_KEY || "pk_demo_local";
const API = process.env.PLAIN_API || "http://localhost:3000/api/v1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function firstPartyCookies(req, pathname) {
  const https = req.headers["x-forwarded-proto"] === "https";
  const secure = https ? "; Secure" : "";
  const existing = parseCookies(req.headers.cookie);
  const cookies = [];
  if (!existing.hr_session) {
    cookies.push(`hr_session=${randomBytes(16).toString("hex")}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  }
  if (!existing.localization) {
    cookies.push(`localization=GB; Path=/; Max-Age=31536000; SameSite=Lax${secure}`);
  }
  if (pathname === "/cart.html" && !existing.cart) {
    cookies.push(`cart=c1-${randomBytes(12).toString("hex")}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`);
  }
  return cookies;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

async function serveFile(req, res, file, extraHeaders = {}) {
  let info;
  try {
    info = await stat(file);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === ".html";
  if (isHtml) {
    const html = (await readFile(file, "utf8")).replaceAll("__PLAIN_SITE_KEY__", SITE_KEY).replaceAll("__PLAIN_API__", API);
    const body = Buffer.from(html);
    res.writeHead(200, { "Content-Type": TYPES[ext], "Content-Length": body.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders });
    res.end(req.method === "HEAD" ? undefined : body);
    return true;
  }
  const headers = {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": isHtml ? "no-store" : "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  };
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  // The SDK bundle is served from the app's build output, never copied into this folder.
  if (pathname === "/sdk/plain-consent.js" || pathname === "/sdk/plain-consent.js.map") {
    const file = path.join(SDK_DIST, path.basename(pathname));
    const ok = await serveFile(req, res, file, { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
    if (!ok) {
      send(
        res,
        404,
        `// plain-consent.js is not built yet.\n// Run \`npm run sdk:build\` from the repository root, then reload.\n// Looked for: ${file}\n`,
        { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" },
      );
    }
    log(req, ok ? 200 : 404);
    return;
  }

  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const file = path.resolve(ROOT, "." + pathname);
  // Refuse traversal outside the site folder and never serve the server's own source.
  if (!file.startsWith(ROOT + path.sep) || path.basename(file) === "server.mjs") {
    send(res, 404, "Not found");
    log(req, 404);
    return;
  }

  const extra = {};
  if (path.extname(file) === ".html") {
    const cookies = firstPartyCookies(req, pathname);
    if (cookies.length) extra["Set-Cookie"] = cookies;
  }
  const ok = await serveFile(req, res, file, extra);
  if (!ok) send(res, 404, "Not found");
  log(req, ok ? 200 : 404);
});

function log(req, status) {
  if (process.env.QUIET) return;
  console.log(`${new Date().toISOString()} ${status} ${req.method} ${req.url}`);
}

server.listen(PORT, () => {
  console.log(`Halden & Rye demo storefront on http://localhost:${PORT}`);
  console.log(`plain-consent.js served from ${SDK_DIST} (site key ${SITE_KEY})`);
  console.log("Banner config and receipts come from the dashboard API at " + API + " (npm run dev).");
});
