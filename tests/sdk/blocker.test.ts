// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://shop.example/","settings":{"enableJavaScriptEvaluation":true,"disableJavaScriptFileLoading":true,"navigation":{"disableChildFrameNavigation":true},"handleDisabledFileLoadingAsSuccess":true,"suppressInsecureJavaScriptEnvironmentWarning":true}}
import { beforeEach, describe, expect, it } from "vitest";
import { release, setPatterns, startBlocking } from "../../sdk/src/blocker";
import { BUILTIN } from "../../sdk/src/builtin";
import type { Cats } from "../../sdk/src/types";

type Win = Window & { ran?: string[] };
const w = window as Win;
const cats: Cats = { essential: true, functional: false, analytics: false, marketing: false };
startBlocking(BUILTIN, (c) => cats[c] === true);
/** MutationObserver callbacks run asynchronously */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  Object.assign(cats, { functional: false, analytics: false, marketing: false });
  setPatterns(BUILTIN);
  document.body.innerHTML = "";
  w.ran = [];
});

describe("static blocking", () => {
  it("holds type=text/plain data-consent scripts until their category is allowed, then runs them", async () => {
    document.body.innerHTML = `<script type="text/plain" data-consent="analytics" data-type="text/javascript" id="a">window.ran.push("analytics")</script>
<script type="text/plain" data-consent="marketing">window.ran.push("marketing")</script>`;
    release();
    expect(w.ran).toEqual([]);

    cats.analytics = true;
    release();
    expect(w.ran).toEqual(["analytics"]);
    const clone = document.getElementById("a") as HTMLScriptElement;
    expect(clone.type).toBe("text/javascript");
    expect(clone.hasAttribute("data-consent")).toBe(false);
    expect(document.querySelectorAll('script[data-consent="marketing"]')).toHaveLength(1);

    release(); // released scripts never run twice
    expect(w.ran).toEqual(["analytics"]);
  });
});

describe("dynamic blocking", () => {
  it("holds a created script before it can load, via the src property and setAttribute", () => {
    const a = document.createElement("script");
    a.src = "https://www.google-analytics.com/analytics.js";
    const b = document.createElement("script");
    b.setAttribute("src", "https://connect.facebook.net/en_US/fbevents.js");
    document.head.append(a, b);
    for (const [el, c] of [[a, "analytics"], [b, "marketing"]] as const) {
      expect(el.getAttribute("src")).toBeNull();
      expect(el.type).toBe("text/plain");
      expect(el.getAttribute("data-consent")).toBe(c);
    }
    expect(a.getAttribute("data-plain-src")).toBe("https://www.google-analytics.com/analytics.js");
  });

  it("leaves non-tracker scripts and iframes alone", () => {
    const s = document.createElement("script");
    s.src = "https://cdn.shop.example/app.js";
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/x";
    document.body.append(s, f);
    expect(s.getAttribute("src")).toBe("https://cdn.shop.example/app.js");
    expect(s.type).toBe("");
    expect(f.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/x");
  });

  it("holds created iframes", () => {
    const f = document.createElement("iframe");
    f.src = "https://connect.facebook.net/plugins/like.php";
    document.body.append(f);
    expect(f.getAttribute("src")).toBeNull();
    expect(f.getAttribute("data-consent")).toBe("marketing");
  });

  it("holds scripts and iframes injected as markup (not through createElement)", async () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = `<script src="https://static.hotjar.com/c/hotjar-1.js"></script><iframe src="https://snap.licdn.com/x"></iframe>`;
    document.body.append(tpl.content);
    await flush();
    const s = document.querySelector("script[data-plain-src]") as HTMLScriptElement;
    const f = document.querySelector("iframe") as HTMLIFrameElement;
    expect(s.type).toBe("text/plain");
    expect(s.getAttribute("data-consent")).toBe("analytics");
    expect(f.hasAttribute("src")).toBe(false);
    expect(f.getAttribute("data-plain-src")).toBe("https://snap.licdn.com/x");
  });

  it("release clones held scripts with their attributes and loads held iframes", () => {
    const s = document.createElement("script");
    s.async = true;
    s.setAttribute("data-id", "hj");
    s.src = "https://static.hotjar.com/c/hotjar-1.js";
    const f = document.createElement("iframe");
    f.src = "https://connect.facebook.net/plugins/like.php";
    document.body.append(s, f);

    cats.analytics = true;
    cats.marketing = true;
    release();
    const clone = document.querySelector('script[data-id="hj"]') as HTMLScriptElement;
    expect(clone).not.toBe(s);
    expect(s.isConnected).toBe(false);
    expect(clone.getAttribute("src")).toBe("https://static.hotjar.com/c/hotjar-1.js");
    expect(clone.type).toBe("");
    expect(clone.hasAttribute("async")).toBe(true);
    expect(clone.hasAttribute("data-consent") || clone.hasAttribute("data-plain-src")).toBe(false);
    expect(f.getAttribute("src")).toBe("https://connect.facebook.net/plugins/like.php");
  });

  it("does not hold an already-allowed category", () => {
    cats.analytics = true;
    const s = document.createElement("script");
    s.src = "https://www.google-analytics.com/analytics.js";
    expect(s.getAttribute("src")).toBe("https://www.google-analytics.com/analytics.js");
  });
});

describe("matching is by hostname and path, not substring", () => {
  it("a tracker host in the query string or path of another site doesn't match", () => {
    for (const url of [
      "https://cdn.shop.example/lib.js?ref=connect.facebook.net",
      "https://cdn.shop.example/connect.facebook.net/lib.js",
      "https://notclarity.ms.shop.example/x.js",
      "https://googletagmanager.com.evil.example/gtag/js",
    ]) {
      const s = document.createElement("script");
      s.src = url;
      expect(s.getAttribute("src"), url).toBe(url);
    }
  });

  it("subdomains match, and path patterns need the path prefix", () => {
    const sub = document.createElement("script");
    sub.src = "https://www.clarity.ms/tag/abc";
    expect(sub.getAttribute("data-consent")).toBe("analytics");
    const gtag = document.createElement("script");
    gtag.src = "https://www.googletagmanager.com/gtag/js?id=G-1";
    expect(gtag.getAttribute("data-consent")).toBe("analytics");
    const gtm = document.createElement("script");
    gtm.src = "https://www.googletagmanager.com/gtm.js?id=GTM-1"; // Tag Manager itself isn't held by the gtag pattern
    expect(gtm.getAttribute("src")).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-1");
  });

  it("site patterns from the config apply, including first-party paths", () => {
    setPatterns([...BUILTIN, { p: "/_vercel/insights", c: "analytics" }, { p: "https://*.widgets.example/embed", c: "functional" }]);
    const a = document.createElement("script");
    a.src = "/_vercel/insights/script.js";
    const b = document.createElement("iframe");
    b.src = "https://eu.widgets.example/embed/chat";
    const c = document.createElement("iframe");
    c.src = "https://eu.widgets.example/other";
    expect(a.getAttribute("data-consent")).toBe("analytics");
    expect(b.getAttribute("data-consent")).toBe("functional");
    expect(c.getAttribute("src")).toBe("https://eu.widgets.example/other");
  });
});
