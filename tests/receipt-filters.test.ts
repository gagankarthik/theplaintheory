import { describe, expect, it } from "vitest";
import { viewerLocation } from "@/lib/geo";
import { filterQuery, filterRange, hasFieldFilters, hasFilters, matchesReceipt, parseReceiptFilters } from "@/lib/receipt-filters";

const receipt = (over: Partial<Parameters<typeof matchesReceipt>[0]> = {}) => ({
  action: "accept_all" as const,
  framework: "dpdpa" as const,
  visitorId: "3f9a1c0b2e4d5f6a",
  timestamp: "2026-10-07T07:39:11.000Z",
  gpc: undefined as boolean | undefined,
  ...over,
});

describe("consent log filters", () => {
  it("keeps valid values and drops anything unrecognised", () => {
    const f = parseReceiptFilters({ action: "reject_all", framework: "gdpr", from: "2026-10-01", to: "2026-10-07", visitor: "3F9A1C", gpc: "1" });
    expect(f).toEqual({ action: "reject_all", framework: "gdpr", from: "2026-10-01", to: "2026-10-07", visitor: "3f9a1c", gpc: true });
    expect(parseReceiptFilters({ action: "delete_all", framework: "x", from: "yesterday", visitor: "not-hex!", gpc: "yes" })).toEqual({
      action: undefined,
      framework: undefined,
      from: undefined,
      to: undefined,
      visitor: undefined,
      gpc: undefined,
    });
  });

  it("treats the empty fields a GET form submits as no filter", () => {
    const f = parseReceiptFilters({ action: "", framework: "", from: "", to: "", visitor: "" });
    expect(hasFilters(f)).toBe(false);
    expect(filterQuery(f)).toEqual({});
  });

  it("swaps a reversed date range and makes both ends inclusive", () => {
    const f = parseReceiptFilters({ from: "2026-10-07", to: "2026-10-01" });
    expect(filterRange(f)).toEqual({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-07T23:59:59.999Z" });
    expect(hasFieldFilters(f)).toBe(false);
    expect(hasFilters(f)).toBe(true);
  });

  it("matches on decision, notice, visitor prefix, GPC and dates", () => {
    expect(matchesReceipt(receipt(), parseReceiptFilters({ action: "accept_all", framework: "dpdpa", visitor: "3f9a1c" }))).toBe(true);
    expect(matchesReceipt(receipt(), parseReceiptFilters({ action: "revoke" }))).toBe(false);
    expect(matchesReceipt(receipt(), parseReceiptFilters({ framework: "gdpr" }))).toBe(false);
    expect(matchesReceipt(receipt(), parseReceiptFilters({ visitor: "aaaa" }))).toBe(false);
    expect(matchesReceipt(receipt(), parseReceiptFilters({ gpc: "1" }))).toBe(false);
    expect(matchesReceipt(receipt({ gpc: true }), parseReceiptFilters({ gpc: "1" }))).toBe(true);
    expect(matchesReceipt(receipt(), parseReceiptFilters({ from: "2026-10-07", to: "2026-10-07" }))).toBe(true);
    expect(matchesReceipt(receipt(), parseReceiptFilters({ to: "2026-10-06" }))).toBe(false);
  });

  it("round-trips through the query string", () => {
    const f = parseReceiptFilters({ action: "custom", gpc: "1", visitor: "abcd" });
    expect(parseReceiptFilters(filterQuery(f))).toEqual(f);
  });
});

describe("viewer location", () => {
  it("prefers the hosting platform's own country header over a CloudFront header a client could send", () => {
    const h = new Headers({ "x-vercel-ip-country": "in", "cloudfront-viewer-country": "DE" });
    expect(viewerLocation(h).country).toBe("IN");
    expect(viewerLocation(new Headers({ "cloudfront-viewer-country": "de" })).country).toBe("DE");
    expect(viewerLocation(new Headers()).country).toBe("XX");
  });
});
