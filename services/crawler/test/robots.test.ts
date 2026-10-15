import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAllowedUrl } from "../src/net-guard";
import { fetchRobots, parseRobots } from "../src/scanner/robots";

const ROBOTS = `
# comment
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /checkout
Disallow: /*.json$
Allow: /checkout/help
Disallow:

Sitemap: https://shop.example/sitemap.xml
`;

describe("robots.txt", () => {
  const policy = parseRobots(ROBOTS);

  it("applies the * group when no specific group matches", () => {
    expect(policy.isAllowed("https://shop.example/")).toBe(true);
    expect(policy.isAllowed("https://shop.example/checkout/pay")).toBe(false);
  });

  it("uses longest match with Allow winning", () => {
    expect(policy.isAllowed("https://shop.example/checkout/help")).toBe(true);
  });

  it("supports * and $ wildcards", () => {
    expect(policy.isAllowed("https://shop.example/api/data.json")).toBe(false);
    expect(policy.isAllowed("https://shop.example/api/data.json?x=1")).toBe(true);
  });

  it("prefers a group naming our product token", () => {
    const specific = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: CMPScanner\nDisallow: /private\n");
    expect(specific.isAllowed("https://shop.example/")).toBe(true);
    expect(specific.isAllowed("https://shop.example/private/x")).toBe(false);
  });

  it("treats grouped user-agent lines as one group", () => {
    const grouped = parseRobots("User-agent: a\nUser-agent: *\nDisallow: /x\n");
    expect(grouped.isAllowed("https://shop.example/x")).toBe(false);
  });
});

describe("fetchRobots", () => {
  let server: Server;
  let origin = "";
  const hits: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      hits.push(req.url ?? "");
      const path = (req.url ?? "/").split("?")[0];
      if (path === "/robots.txt") return void res.writeHead(301, { location: "/moved/robots.txt" }).end();
      if (path === "/moved/robots.txt") return void res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /secret\n");
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  /** Lets the local test server through and asks the real guard about everything else. */
  const guarded = (seen: string[]) => async (url: string) => {
    seen.push(url);
    return url.startsWith(origin) || isAllowedUrl(url);
  };

  it("follows same-site redirects, checking every hop", async () => {
    const seen: string[] = [];
    const policy = await fetchRobots(`${origin}/`, "test", { guard: guarded(seen) });
    expect(policy.isAllowed(`${origin}/secret/x`)).toBe(false);
    expect(seen).toEqual([`${origin}/robots.txt`, `${origin}/moved/robots.txt`]);
  });

  it("refuses a redirect to the metadata address without fetching it", async () => {
    const seen: string[] = [];
    // fetchRobots always asks for /robots.txt, so point the start at a server that redirects it.
    const redirector = createServer((_req, res) => res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end());
    await new Promise<void>((r) => redirector.listen(0, "127.0.0.1", () => r()));
    const redirectOrigin = `http://127.0.0.1:${(redirector.address() as AddressInfo).port}`;
    try {
      const policy = await fetchRobots(`${redirectOrigin}/`, "test", {
        guard: async (url) => (seen.push(url), url.startsWith(redirectOrigin) || isAllowedUrl(url)),
        timeoutMs: 2000,
      });
      expect(policy.rules).toEqual([]);
      expect(seen).toEqual([`${redirectOrigin}/robots.txt`, "http://169.254.169.254/latest/meta-data/"]);
    } finally {
      await new Promise<void>((r) => redirector.close(() => r()));
    }
  });

  it("refuses private start addresses with the real guard", async () => {
    const before = hits.length;
    const policy = await fetchRobots(`${origin}/`, "test", { guard: isAllowedUrl });
    expect(policy.rules).toEqual([]);
    expect(hits.length).toBe(before);
  });

  it("checks the address it connects to, not only the guard's answer (DNS rebinding)", async () => {
    const before = hits.length;
    // A guard fooled into saying yes: the connection-time lookup still refuses localhost → 127.0.0.1.
    const port = new URL(origin).port;
    const policy = await fetchRobots(`http://localhost:${port}/`, "test", { guard: async () => true });
    expect(policy.rules).toEqual([]);
    expect(hits.length).toBe(before);
  });

  it("gives up after five redirects", async () => {
    const loop = createServer((_req, res) => res.writeHead(302, { location: "/robots.txt" }).end());
    await new Promise<void>((r) => loop.listen(0, "127.0.0.1", () => r()));
    const loopOrigin = `http://127.0.0.1:${(loop.address() as AddressInfo).port}`;
    let requests = 0;
    loop.on("request", () => requests++);
    try {
      const policy = await fetchRobots(`${loopOrigin}/`, "test", { guard: async () => true });
      expect(policy.rules).toEqual([]);
      expect(requests).toBe(6);
    } finally {
      await new Promise<void>((r) => loop.close(() => r()));
    }
  });
});
