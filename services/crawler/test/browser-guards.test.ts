import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Browser } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "../src/scanner/browser";
import { scanSite } from "../src/scanner/crawl";
import { capturePage } from "../src/scanner/page-capture";

/**
 * Real Chromium against a local server: what request interception cannot see (WebSockets, service
 * workers), guard failures, and the per-scan time limit.
 */
describe("browser guards (headless Chromium)", () => {
  let browser: Browser;
  let server: Server;
  let site = "";
  let upgrades = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = (req.url ?? "/").split("?")[0];
      const port = (server.address() as AddressInfo).port;
      if (path === "/ws") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<!doctype html><title>ws</title><script>
          window.wsState = "pending";
          const s = new WebSocket("ws://127.0.0.1:${port}/socket");
          s.onerror = () => (window.wsState = "error");
          s.onopen = () => (window.wsState = "open");
        </script>`);
        return;
      }
      if (path === "/sw") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<!doctype html><title>sw</title><script>
          window.swState = "pending";
          navigator.serviceWorker.register("/sw.js").then(() => (window.swState = "registered"), (e) => (window.swState = e.name));
        </script>`);
        return;
      }
      if (path === "/sw.js") return void res.writeHead(200, { "content-type": "text/javascript" }).end("self.addEventListener('fetch', () => {});");
      if (path === "/slow") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<!doctype html><title>slow</title>${Array.from({ length: 5 }, (_, i) => `<a href="/slow/${i}">${i}</a>`).join("")}`);
        return;
      }
      if (path.startsWith("/slow/")) return void res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>child</title>");
      if (path === "/robots.txt") return void res.writeHead(404).end();
      res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><title>ok</title><img src="/pixel.gif">`);
    });
    // The handshake reaches the server as an upgrade; counting them proves whether Chromium connected.
    server.on("upgrade", (_req, socket) => {
      upgrades++;
      socket.destroy();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    site = `http://localhost:${(server.address() as AddressInfo).port}`;
    browser = await launchBrowser();
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  const opts = { userAgent: "test", timeoutMs: 10_000, settleMs: 300 };

  it("blocks WebSockets to private addresses when a guard is in force", async () => {
    const context = await browser.createBrowserContext();
    try {
      upgrades = 0;
      await capturePage(context, `${site}/ws`, { ...opts, guard: async () => true });
      expect(upgrades).toBe(0);
      // Control: without a guard the same page does connect, so the check above is meaningful.
      await capturePage(context, `${site}/ws`, opts);
      expect(upgrades).toBe(1);
    } finally {
      await context.close();
    }
  }, 60_000);

  it("refuses service worker registration when a guard is in force", async () => {
    const context = await browser.createBrowserContext();
    try {
      const workers = () => browser.targets().filter((t) => t.type() === "service_worker").length;
      const capture = await capturePage(context, `${site}/sw`, { ...opts, guard: async () => true });
      expect(capture.status).toBe(200);
      expect(workers()).toBe(0);
      // Control: without a guard the page registers its worker.
      await capturePage(context, `${site}/sw`, opts);
      await expect.poll(workers, { timeout: 5000 }).toBe(1);
    } finally {
      await context.close();
    }
  }, 60_000);

  it("aborts requests whose guard check throws instead of leaving them hanging", async () => {
    const context = await browser.createBrowserContext();
    try {
      const t0 = Date.now();
      const capture = await capturePage(context, `${site}/`, {
        ...opts,
        guard: async (url) => {
          if (url.endsWith("/pixel.gif")) throw new Error("resolver exploded");
          return true;
        },
      });
      expect(capture.status).toBe(200);
      expect(capture.blocked.some((u) => u.endsWith("/pixel.gif"))).toBe(true);
      expect(capture.warnings.some((w) => /did not settle/.test(w))).toBe(false);
      expect(Date.now() - t0).toBeLessThan(opts.timeoutMs);
    } finally {
      await context.close();
    }
  }, 60_000);

  it("stops at the scan deadline and returns what it captured", async () => {
    const logs: string[] = [];
    const result = await scanSite(
      { startUrl: `${site}/slow`, maxDepth: 1, maxPages: 6, settleMs: 0, pageDelayMs: 0, pageTimeoutMs: 10_000, deadlineMs: 1, onLog: (l, m) => logs.push(`${l} ${m}`) },
      browser,
    );
    expect(result.timedOut).toBe(true);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].ok).toBe(true);
    expect(logs.some((l) => l.startsWith("WARN Time limit reached"))).toBe(true);
  }, 60_000);
});
