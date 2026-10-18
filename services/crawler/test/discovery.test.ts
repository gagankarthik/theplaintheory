import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanSite } from "../src/scanner/crawl";
import { parseRobots } from "../src/scanner/robots";
import { discoverSitemapUrls, parseSitemap } from "../src/scanner/sitemaps";
import type { ScanResult } from "../src/scanner/types";
import { templateKey } from "../src/scanner/url";

describe("discovery building blocks", () => {
  it("reads Sitemap: lines from robots.txt wherever they appear", () => {
    const r = parseRobots("Sitemap: https://shop.example/sitemap_index.xml\nUser-agent: *\nDisallow: /cart\n\nSitemap: https://shop.example/news.xml # news\n");
    expect(r.sitemaps).toEqual(["https://shop.example/sitemap_index.xml", "https://shop.example/news.xml"]);
    expect(r.isAllowed("https://shop.example/cart")).toBe(false);
  });

  it("parses url sets and sitemap indexes, with CDATA and entities", () => {
    expect(parseSitemap(`<urlset><url><loc>https://a.example/x?a=1&amp;b=2</loc></url><url><loc><![CDATA[https://a.example/y]]></loc></url></urlset>`)).toEqual({
      kind: "urlset",
      locs: ["https://a.example/x?a=1&b=2", "https://a.example/y"],
    });
    expect(parseSitemap(`<sitemapindex><sitemap><loc>https://a.example/s1.xml</loc></sitemap></sitemapindex>`).kind).toBe("index");
  });

  it("groups pages by template the way a crawl budget would", () => {
    expect(templateKey("https://shop.example/product/house-blend")).toBe(templateKey("https://www.shop.example/product/cold-brew?ref=x"));
    expect(templateKey("https://shop.example/blog/2026/why-tuesdays")).toBe("shop.example/blog/:id/*");
    expect(templateKey("https://shop.example/order/8f3a91c2d4e5")).toBe("shop.example/order/:id");
    expect(templateKey("https://shop.example/checkout")).not.toBe(templateKey("https://shop.example/cart"));
  });
});

describe("Google-style discovery (headless Chromium)", () => {
  let server: Server;
  let base: string;
  let result: ScanResult;
  const page = (title: string, body: string, head = "") => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = (req.url ?? "/").split("?")[0];
      const html = (b: string) => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(b);
      if (path === "/robots.txt") return void res.writeHead(200, { "content-type": "text/plain" }).end(`User-agent: *\nDisallow: /admin\nSitemap: ${base}/sitemap_index.xml\n`);
      if (path === "/sitemap_index.xml") {
        return void res.writeHead(200, { "content-type": "application/xml" }).end(`<sitemapindex><sitemap><loc>${base}/pages.xml.gz</loc></sitemap></sitemapindex>`);
      }
      if (path === "/pages.xml.gz") {
        // gzipped sitemap; /checkout is linked from nowhere else, /admin is disallowed by robots.txt
        const urls = ["/checkout", "/admin/secret", "/blog/why-tuesdays", ...Array.from({ length: 30 }, (_, i) => `/product/item-${i}`)];
        return void res.writeHead(200, { "content-type": "application/gzip" }).end(gzipSync(`<urlset>${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join("")}</urlset>`));
      }
      // the homepage links to 30 products first, so a link-order crawl would spend its budget on them
      if (path === "/") return html(page("Home", Array.from({ length: 30 }, (_, i) => `<a href="/product/item-${i}">P${i}</a>`).join("") + `<a href="/blog/why-tuesdays">Blog</a><a href="/promo">Promo</a>`));
      // a duplicate that names the real page as canonical
      if (path === "/promo") return html(page("Promo", "<p>Same as the blog post</p>", `<link rel="canonical" href="${base}/blog/why-tuesdays">`));
      if (path.startsWith("/product/") || path === "/blog/why-tuesdays" || path === "/checkout" || path.startsWith("/admin")) return html(page(path, `<p>${path}</p>`));
      res.writeHead(404).end();
    });
    const port = await new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as AddressInfo).port)));
    base = `http://localhost:${port}`;
    result = await scanSite({ startUrl: `${base}/`, maxPages: 6, maxDepth: 2, pageTimeoutMs: 15_000, settleMs: 200, pageDelayMs: 0 });
  }, 120_000);

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("finds pages only listed in the sitemap (index, gzipped)", async () => {
    const urls = await discoverSitemapUrls(`${base}/`, [`${base}/sitemap_index.xml`], { userAgent: "test" });
    expect(urls).toContain(`${base}/checkout`);
    expect(urls).toHaveLength(33);
    expect(result.pages.map((p) => new URL(p.url).pathname)).toContain("/checkout");
  });

  it("spreads a small budget across kinds of page instead of 6 products", () => {
    const paths = result.pages.map((p) => new URL(p.url).pathname);
    const products = paths.filter((p) => p.startsWith("/product/")).length;
    expect(products).toBeLessThanOrEqual(2);
    expect(paths).toEqual(expect.arrayContaining(["/", "/checkout", "/blog/why-tuesdays"]));
  });

  it("still honours robots.txt for sitemap pages", () => {
    expect(result.pages.some((p) => p.url.includes("/admin"))).toBe(false);
  });
});
