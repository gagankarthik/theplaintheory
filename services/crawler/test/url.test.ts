import { describe, expect, it } from "vitest";
import { buildStartUrl, extractCrawlableLinks, hasBinaryExtension, isInternalUrl, normalizeUrl } from "../src/scanner/url";

describe("buildStartUrl", () => {
  it("uses http for local and ported hosts, https otherwise", () => {
    expect(buildStartUrl("localhost:4000")).toBe("http://localhost:4000/");
    expect(buildStartUrl("127.0.0.1")).toBe("http://127.0.0.1/");
    expect(buildStartUrl("staging.shop.example:8443")).toBe("http://staging.shop.example:8443/");
    expect(buildStartUrl("shop.example")).toBe("https://shop.example/");
    expect(buildStartUrl("https://shop.example/en")).toBe("https://shop.example/en");
  });
});

describe("normalizeUrl", () => {
  it("strips fragments and tracking params and sorts the rest", () => {
    expect(normalizeUrl("https://shop.example/p?utm_source=x&b=2&gclid=1&a=1#top")).toBe("https://shop.example/p?a=1&b=2");
  });
  it("resolves relative links and rejects non-http schemes", () => {
    expect(normalizeUrl("../about", "https://shop.example/en/cart")).toBe("https://shop.example/about");
    expect(normalizeUrl("mailto:hi@shop.example")).toBeNull();
    expect(normalizeUrl("javascript:void(0)")).toBeNull();
  });
});

describe("link filtering", () => {
  it("keeps internal pages on the same registrable domain", () => {
    expect(isInternalUrl("https://blog.shop.example/x", "https://www.shop.example/")).toBe(true);
    expect(isInternalUrl("https://other.example/x", "https://www.shop.example/")).toBe(false);
  });
  it("requires an exact host:port match for local hosts", () => {
    expect(isInternalUrl("http://localhost:4000/a", "http://localhost:4000/")).toBe(true);
    expect(isInternalUrl("http://localhost:3000/a", "http://localhost:4000/")).toBe(false);
  });
  it("detects binary resources", () => {
    expect(hasBinaryExtension("https://shop.example/files/terms.PDF")).toBe(true);
    expect(hasBinaryExtension("https://shop.example/products/shoe")).toBe(false);
  });
  it("extracts and dedupes crawlable links", () => {
    const links = extractCrawlableLinks(
      ["/a", "/a#x", "/a?utm_medium=y", "tel:+13128471928", "https://cdn.other.example/x", "/img/hero.jpg", "  /b  "],
      "https://shop.example/",
      "https://shop.example/",
    );
    expect(links).toEqual(["https://shop.example/a", "https://shop.example/b"]);
  });
});
