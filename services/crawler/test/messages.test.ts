import { describe, expect, it } from "vitest";
import { parseCrawlMessage } from "../src/messages";
import { isAllowedUrl } from "../src/net-guard";

describe("crawl queue messages", () => {
  it("parses the dashboard's contract", () => {
    expect(parseCrawlMessage('{"type":"CRAWL","propertyId":"prop_abc","scanId":"scan_123"}')).toEqual({
      type: "CRAWL",
      propertyId: "prop_abc",
      scanId: "scan_123",
    });
  });
  it("rejects malformed or foreign bodies", () => {
    expect(parseCrawlMessage("not json")).toBeNull();
    expect(parseCrawlMessage('{"type":"CRAWL","propertyId":"p"}')).toBeNull();
    expect(parseCrawlMessage('{"type":"PURGE","propertyId":"prop_abc","scanId":"scan_123"}')).toBeNull();
    expect(parseCrawlMessage('{"type":"CRAWL","propertyId":"../etc","scanId":"s"}')).toBeNull();
    expect(parseCrawlMessage(undefined)).toBeNull();
  });
});

describe("network guard (SSRF)", () => {
  it("refuses private, loopback and metadata addresses", async () => {
    delete process.env.CRAWLER_ALLOW_PRIVATE_NETWORK;
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://[::ffff:169.254.169.254]/",
      "http://127.0.0.1:4000/",
      "http://localhost:3000/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://[::1]/",
      "http://metadata.internal/",
    ]) {
      expect(await isAllowedUrl(url), url).toBe(false);
    }
  });
  it("lets non-network schemes through and honours the local override", async () => {
    expect(await isAllowedUrl("data:text/plain,hi")).toBe(true);
    process.env.CRAWLER_ALLOW_PRIVATE_NETWORK = "true";
    expect(await isAllowedUrl("http://127.0.0.1:4000/")).toBe(true);
    delete process.env.CRAWLER_ALLOW_PRIVATE_NETWORK;
  });
});
