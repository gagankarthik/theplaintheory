// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://shop.example/"}
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUi, type UiHandlers } from "../../sdk/src/ui";
import { bannerHtml, prefsHtml, type RenderInput } from "../../sdk/src/ui/templates";
import type { PublicConfig } from "../../sdk/src/types";
import { publicConfig } from "./fixture";

const XSS = `"><img src=x onerror="window.pwned=1"><script>window.pwned=1</script>`;
const NONE = { essential: true, functional: false, analytics: false, marketing: false };
const input = (cfg: PublicConfig, view: RenderInput["view"] = "banner"): RenderInput => ({ cfg, framework: "gdpr", cats: { ...NONE }, view, fab: true });

/** Parse rendered markup the way the shadow root would. */
function parse(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}
const injected = (el: Element) => el.querySelectorAll("img,script,iframe,[onerror],[onclick],[onmouseover]").length;

/** Render through the real UI and capture its closed shadow root. */
function mount(cfg: PublicConfig, h: UiHandlers = { accept() {}, reject() {}, save() {}, close() {} }) {
  let root!: ShadowRoot;
  const orig = Element.prototype.attachShadow;
  const spy = vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, o: ShadowRootInit) {
    return (root = orig.call(this, o));
  });
  createUi().render(input(cfg), h);
  spy.mockRestore();
  return root;
}

/** A config with hostile values everywhere a customer (or a tampered config) could put text. */
function hostile() {
  const cfg = publicConfig();
  const copy = cfg.regions.gdpr!.copy;
  for (const k of Object.keys(copy) as (keyof typeof copy)[]) copy[k] = XSS;
  cfg.categories = cfg.categories.map((c) => ({
    ...c,
    id: (c.required ? c.id : `${c.id}" onclick="x`) as typeof c.id,
    label: XSS,
    description: XSS,
    dataItems: [XSS],
    retention: XSS,
  }));
  const t = cfg.theme as unknown as Record<string, unknown>;
  t.background = `#fff" onmouseover="x`;
  t.text = `red;}</style><img src=x>`;
  t.accent = "url(https://evil.example/x)";
  t.accentText = "expression(alert(1))";
  t.radius = "4px;background:url(x)";
  t.font = "__proto__";
  t.position = `bottom" onclick="x`;
  cfg.policyUrl = "javascript:alert(1)";
  return cfg;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("templates escape every value", () => {
  it("banner copy, theme values and policy link cannot inject markup or styles", () => {
    const el = parse(bannerHtml(input(hostile())));
    expect(injected(el)).toBe(0);
    const w = el.querySelector(".w") as HTMLElement;
    const style = w.getAttribute("style")!;
    expect(style).not.toMatch(/url\(|expression|onmouseover|<|object/i);
    expect(style).toContain("--bg:#ffffff"); // invalid colours fall back
    expect(style).toContain("--r:4px");
    expect(w.className).toContain("bottom");
    expect(el.querySelector("a[href^='javascript']")).toBeNull();
    expect(el.querySelector("h2")!.textContent).toBe(XSS);
  });

  it("preference centre copy and category ids stay inert", () => {
    const el = parse(prefsHtml(input(hostile(), "prefs")));
    expect(injected(el)).toBe(0);
    const sw = el.querySelectorAll("[data-c]");
    expect(sw.length).toBe(3);
    sw.forEach((b) => expect(b.getAttribute("data-c")).toMatch(/^\w+" onclick="x$/)); // kept as data, never an attribute
    expect(el.querySelector(".di li")!.textContent).toBe(XSS);
  });

  it("the floating pill escapes too", () => {
    const cfg = hostile();
    cfg.theme.layout = "pill";
    expect(injected(parse(bannerHtml(input(cfg))))).toBe(0);
  });
});

describe("floating pill", () => {
  const pill = (equalButtons: boolean) =>
    publicConfig((c) => {
      c.theme.layout = "pill";
      c.theme.equalButtons = equalButtons;
    });

  it("collapses to a disclosure and gives Reject and Accept equal weight even when equal buttons is off", () => {
    const el = parse(bannerHtml(input(pill(false))));
    const toggle = el.querySelector(".pt")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((el.querySelector("#pt-pp") as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('[data-a="reject"]')!.className).toBe(el.querySelector('[data-a="accept"]')!.className);
  });

  it("expands in the live UI, and its choices work", () => {
    const h: UiHandlers = { accept: vi.fn(), reject: vi.fn(), save: vi.fn(), close: vi.fn() };
    const root = mount(pill(true), h);
    const toggle = root.querySelector<HTMLButtonElement>(".pt")!;
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(root.getElementById("pt-pp")!.hidden).toBe(false);
    expect(root.querySelector(".w")!.classList.contains("op")).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-a="reject"]')!.click();
    expect(h.reject).toHaveBeenCalled();
  });
});

describe("custom CSS in the shadow root", () => {
  const withCss = (css: string) => mount(publicConfig((c) => (c.theme.customCss = css)));

  it("is applied after the built-in styles, followed by the Reject/Accept guard", () => {
    const styles = Array.from(withCss(".b{box-shadow:none}").querySelectorAll("style")).map((s) => s.textContent);
    expect(styles).toHaveLength(3);
    expect(styles[1]).toBe(".b{box-shadow:none}");
    expect(styles[2]).toContain("[data-a=reject]");
  });

  it("cannot break out of its style element or load anything", () => {
    const root = withCss(
      `.b{color:red}</style><img src=x onerror="window.pwned=1"><style>@import "https://evil.example/x.css";.b{background:url(https://evil.example/p.png)}.x{width:expression(alert(1))}[data-a=reject]{display:none!important}`,
    );
    expect(root.querySelector("img")).toBeNull();
    const custom = root.querySelectorAll("style")[1].textContent!;
    expect(custom).not.toMatch(/<|@import|url\(|expression\(|!important/i);
    expect(custom).toContain(".b{color:red}");
  });

  it("adds nothing when empty", () => {
    expect(withCss("").querySelectorAll("style")).toHaveLength(1);
  });
});
