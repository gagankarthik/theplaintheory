// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://shop.example/"}
import { describe, expect, it } from "vitest";
import { BUILTIN } from "../../sdk/src/builtin";
import { matchesPattern } from "../../sdk/src/match";
import { TRACKER_DB, urlPatternMatches } from "@/lib/tracker-db";

describe("SDK built-in patterns", () => {
  it("every pre-config pattern is a URL pattern of a catalogue tracker with the same category", () => {
    for (const { p, c } of BUILTIN) {
      const def = TRACKER_DB.find((d) => d.urls?.includes(p));
      expect(def, `${p} is not in the tracker catalogue`).toBeDefined();
      expect(def!.category, `${p} category`).toBe(c);
    }
  });

  it("no built-in pattern is an essential tracker", () => {
    expect(BUILTIN.every((b) => b.c !== "essential")).toBe(true);
  });
});

describe("SDK matching agrees with the catalogue's matcher", () => {
  const urls = [
    "https://www.googletagmanager.com/gtag/js?id=G-1",
    "https://www.googletagmanager.com/gtm.js?id=GTM-1",
    "https://region1.google-analytics.com/g/collect",
    "https://connect.facebook.net/en_US/fbevents.js",
    "https://www.facebook.com/tr?id=1",
    "https://cdn.shop.example/x.js?u=connect.facebook.net",
    "https://shop.example/_vercel/insights/script.js",
    "https://static.hotjar.com.evil.example/c.js",
  ];
  const patterns = TRACKER_DB.flatMap((d) => d.urls ?? []);
  it.each(urls)("%s", (url) => {
    const u = new URL(url);
    for (const p of patterns) expect(matchesPattern(u, p), p).toBe(urlPatternMatches(p, u.hostname, u.pathname));
  });
});
