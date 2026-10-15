import { describe, expect, it } from "vitest";
import { configSchema } from "@/lib/config-schema";
import { blockedCss, CUSTOM_CSS_MAX, sanitizeCss } from "@/lib/custom-css";
import { defaultConfig } from "@/lib/defaults";

describe("sanitizeCss", () => {
  it("keeps ordinary rules", () => {
    const css = ".b { box-shadow: none; }\n.bt > button { border-radius: 4px }";
    expect(sanitizeCss(css)).toBe(css);
  });

  it.each([
    ["@import 'x.css'; .a{}", /@import/i],
    [".a{background:url(https://x)}", /url\(/i],
    [".a{background:URL ( x )}", /url/i],
    [".a{background:u/**/rl(x)}", /url\(/i],
    [".a{background:u\\72 l(x)}", /\\/],
    [".a{width:expression(alert(1))}", /expression/i],
    [".a{background:image-set('x.png' 1x)}", /image-set/i],
    ["</style><script>alert(1)</script>", /</],
    [".a{behavior:url(x.htc);-moz-binding:url(x)}", /behavior|binding|url/i],
    [".a{color:red!important}", /important/i],
    [".a{background:urlurl((x))}", /url\(/i],
  ])("strips %s", (css, bad) => {
    expect(sanitizeCss(css)).not.toMatch(bad);
  });

  it("caps the size", () => {
    expect(sanitizeCss("a".repeat(CUSTOM_CSS_MAX + 500)).length).toBe(CUSTOM_CSS_MAX);
  });

  it("names what it blocks", () => {
    expect(blockedCss("@import 'x'; .a{background:url(x)}")).toEqual(["@import", "url("]);
    expect(blockedCss(".a{color:red}")).toEqual([]);
  });
});

describe("config schema", () => {
  const withTheme = (theme: Record<string, unknown>) => {
    const c = defaultConfig("shop.example");
    return { ...c, theme: { ...c.theme, ...theme } };
  };

  it("accepts the floating pill layout and safe custom CSS", () => {
    const r = configSchema.safeParse(withTheme({ layout: "pill", customCss: " .b{padding:24px} /* note */ " }));
    expect(r.success).toBe(true);
    expect(r.data!.theme.layout).toBe("pill");
    expect(r.data!.theme.customCss).toBe(".b{padding:24px}");
  });

  it("rejects custom CSS that loads files or runs code, or is too long", () => {
    expect(configSchema.safeParse(withTheme({ customCss: ".b{background:url(https://x)}" })).success).toBe(false);
    expect(configSchema.safeParse(withTheme({ customCss: "</style><script>" })).success).toBe(false);
    expect(configSchema.safeParse(withTheme({ customCss: "a".repeat(CUSTOM_CSS_MAX + 1) })).success).toBe(false);
  });

  it("drops empty custom CSS", () => {
    expect(configSchema.parse(withTheme({ customCss: "  " })).theme.customCss).toBeUndefined();
  });
});
