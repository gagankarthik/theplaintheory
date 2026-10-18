// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://www.shop.example/"}
import { beforeEach, describe, expect, it } from "vitest";
import { clearDenied, setCookieRules } from "../../sdk/src/shred";
import type { CategoryId } from "../../sdk/src/types";
import { sdkCookies } from "../../src/lib/trackers";
import type { Tracker } from "../../src/lib/types";

// cookies that still hold a value (happy-dom keeps an expired write as an empty cookie; browsers drop it)
const names = () =>
  document.cookie
    .split(";")
    .map((c) => c.trim().split("="))
    .filter(([n, v]) => n && v)
    .map(([n]) => n)
    .sort();
const allow = (...ok: CategoryId[]) => (c: CategoryId) => c === "essential" || ok.includes(c);

beforeEach(() => {
  for (const n of names()) document.cookie = `${n}=;Max-Age=0;Path=/`;
  localStorage.clear();
  sessionStorage.clear();
  setCookieRules([
    { n: "_ga", c: "analytics" },
    { n: "_ga_*", c: "analytics" },
    { n: "_fbp", c: "marketing" },
    { n: "nw_exp_hero", c: "analytics" },
  ]);
  for (const c of ["_ga=GA1.1", "_ga_ABC123=GS1", "_fbp=fb.1", "cart=2", "plain_consent=x"]) document.cookie = `${c};Path=/`;
  localStorage.setItem("nw_exp_hero", "b");
  localStorage.setItem("theme", "dark");
});

describe("clearing cookies for categories that aren't allowed", () => {
  it("before a decision, clears every catalogued analytics and marketing cookie and storage key", () => {
    clearDenied(allow());
    expect(names()).toEqual(["cart", "plain_consent"]);
    expect(Object.keys(localStorage)).toEqual(["theme"]);
  });

  it("keeps what the visitor allowed", () => {
    clearDenied(allow("analytics"));
    expect(names()).toEqual(["_ga", "_ga_ABC123", "cart", "plain_consent"]);
  });

  it("does nothing when everything is allowed", () => {
    clearDenied(allow("analytics", "marketing", "functional"));
    expect(names()).toEqual(["_fbp", "_ga", "_ga_ABC123", "cart", "plain_consent"]);
  });
});

describe("sdkCookies", () => {
  const t = (p: Partial<Tracker>): Tracker => ({ id: p.pattern!, name: p.pattern!, kind: "script", status: "approved", source: "scan", ...p }) as Tracker;

  it("adds each approved vendor's known cookies under the site's category, plus catalogued cookies", () => {
    const rules = sdkCookies([
      t({ pattern: "googletagmanager.com/gtag", category: "analytics" }),
      t({ pattern: "connect.facebook.net", category: "marketing" }),
      t({ pattern: "nw_ab", kind: "cookie", category: "analytics" }),
      t({ pattern: "nw_session", kind: "cookie", category: "essential" }),
      t({ pattern: "static.hotjar.com", category: "analytics", status: "review" }),
    ]);
    const byName = Object.fromEntries(rules.map((r) => [r.n, r.c]));
    expect(byName._ga).toBe("analytics");
    expect(byName["_ga_*"]).toBe("analytics");
    expect(byName._fbp).toBe("marketing");
    expect(byName.nw_ab).toBe("analytics");
    expect(byName.nw_session).toBeUndefined(); // essential: never cleared
    expect(Object.keys(byName).some((n) => n.startsWith("_hj"))).toBe(false); // not approved yet
  });
});
