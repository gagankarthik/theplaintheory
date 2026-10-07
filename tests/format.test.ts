import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDateTimeFull, formatMoney, formatNumber, formatPct, formatRelative, toDate } from "@/lib/format";

const ISO = "2026-10-07T14:05:09.000Z";

describe("dates", () => {
  it("formats a day", () => {
    expect(formatDate(ISO)).toBe("7 Oct 2026");
    expect(formatDate("2026-09-30")).toBe("30 Sep 2026");
    expect(formatDate(new Date(Date.UTC(2026, 0, 1)))).toBe("1 Jan 2026");
  });

  it("formats in UTC, never local time", () => {
    // 23:30 at UTC-5 is the next day in UTC
    expect(formatDate("2026-10-07T23:30:00-05:00")).toBe("8 Oct 2026");
    expect(formatDateTime("2026-10-07T23:30:00-05:00")).toBe("8 Oct 2026, 04:30 UTC");
  });

  it("reads a bare yyyy-mm-dd as UTC midnight", () => {
    expect(toDate("2026-10-07").toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("formats a date and time", () => {
    expect(formatDateTime(ISO)).toBe("7 Oct 2026, 14:05 UTC");
    expect(formatDateTimeFull(ISO)).toBe("7 October 2026, 14:05:09 UTC");
  });

  it("shows a dash for an invalid date", () => {
    expect(formatDate("not a date")).toBe("—");
    expect(formatDateTime("")).toBe("—");
    expect(formatRelative("nope")).toBe("—");
  });

  it("formats relative times", () => {
    const now = Date.parse(ISO);
    expect(formatRelative(now - 20_000, now)).toBe("just now");
    expect(formatRelative(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe("3 hours ago");
    expect(formatRelative(now - 86_400_000, now)).toBe("yesterday");
    expect(formatRelative(now - 3 * 86_400_000, now)).toBe("3 days ago");
    expect(formatRelative(now + 2 * 86_400_000, now)).toBe("in 2 days");
  });
});

describe("numbers", () => {
  it("groups thousands", () => {
    expect(formatNumber(12345)).toBe("12,345");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1.25, 1)).toBe("1.3");
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("formats percentages", () => {
    expect(formatPct(0.4567)).toBe("46%");
    expect(formatPct(0.042)).toBe("4.2%");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(1)).toBe("100%");
    expect(formatPct(0.4567, 1)).toBe("45.7%");
  });

  it("formats money from minor units", () => {
    expect(formatMoney(1999, "usd")).toBe("$19.99");
    expect(formatMoney(4900, "EUR")).toBe("€49.00");
    expect(formatMoney(150000, "gbp")).toBe("£1,500.00");
    expect(formatMoney(49900, "inr")).toBe("₹499.00");
    expect(formatMoney(500, "jpy")).toBe("¥500");
  });
});
