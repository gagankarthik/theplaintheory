import { describe, expect, it } from "vitest";
import { getSetCookieHeader, parseSetCookieHeader, parseSetCookieLine } from "../src/scanner/set-cookie";

const NOW = 1_760_000_000;

describe("Set-Cookie parser", () => {
  it("parses a full attribute set", () => {
    const c = parseSetCookieLine("sid=abc123; Path=/; Domain=.Shop.Example; Secure; HttpOnly; SameSite=strict; Partitioned", NOW)!;
    expect(c).toMatchObject({
      name: "sid",
      valueLength: 6,
      domain: ".shop.example",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Strict",
      partitioned: true,
      expires: null,
    });
  });

  it("Max-Age wins over Expires regardless of order", () => {
    const a = parseSetCookieLine("a=1; Max-Age=3600; Expires=Wed, 21 Oct 2037 07:28:00 GMT", NOW)!;
    const b = parseSetCookieLine("b=1; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Max-Age=3600", NOW)!;
    expect(a.expires).toBe(NOW + 3600);
    expect(b.expires).toBe(NOW + 3600);
  });

  it("parses legacy dashed Expires dates", () => {
    const c = parseSetCookieLine("_ga=GA1.1.1; expires=Thu, 01-Jan-2037 00:00:00 GMT; path=/", NOW)!;
    expect(c.expires).toBe(Date.UTC(2037, 0, 1) / 1000);
  });

  it("treats Max-Age<=0 as immediate expiry", () => {
    expect(parseSetCookieLine("gone=; Max-Age=0", NOW)!.expires).toBe(NOW);
  });

  it("handles quoted values, empty values and junk attributes", () => {
    expect(parseSetCookieLine('q="hello"; Foo; Bar=baz', NOW)!.valueLength).toBe(5);
    expect(parseSetCookieLine("empty=; Path=/", NOW)!.valueLength).toBe(0);
  });

  it("rejects malformed lines", () => {
    expect(parseSetCookieLine("novalue", NOW)).toBeNull();
    expect(parseSetCookieLine("=nokey", NOW)).toBeNull();
    expect(parseSetCookieLine("", NOW)).toBeNull();
  });

  it("splits CDP newline-joined headers", () => {
    const list = parseSetCookieHeader("a=1; HttpOnly\nb=2; Secure\r\nbroken\nc=3", NOW);
    expect(list.map((c) => c.name)).toEqual(["a", "b", "c"]);
    expect(list[0]!.httpOnly).toBe(true);
  });

  it("finds the header case-insensitively", () => {
    expect(getSetCookieHeader({ "Content-Type": "text/html", "Set-Cookie": "x=1" })).toBe("x=1");
    expect(getSetCookieHeader({ "set-cookie": "y=1" })).toBe("y=1");
    expect(getSetCookieHeader(undefined)).toBeNull();
  });
});
