import { describe, expect, it } from "vitest";
import { parseRobots } from "../src/scanner/robots";

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
