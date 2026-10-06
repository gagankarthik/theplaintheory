import type { CategoryId } from "./types";

/**
 * Tracker blocking.
 *  - Static: <script type="text/plain" data-consent="analytics"> stays inert until released.
 *  - Dynamic: scripts/iframes created later whose src matches a tracker pattern are held.
 * Scripts parsed before this SDK runs cannot be blocked, so the SDK must be the first script in <head>.
 */
type Allowed = (c: CategoryId) => boolean;

const HELD = "data-plain-src";
let patterns: { p: string; c: CategoryId }[] = [];
let allowed: Allowed = () => false;

const doc = document;
const scriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src")!;
const iframeSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src")!;

function catFor(src: string | null | undefined): CategoryId | null {
  if (!src) return null;
  for (const t of patterns) if (t.c !== "essential" && src.indexOf(t.p) > -1) return t.c;
  return null;
}

/** Hold an element: remember its src, keep it from loading. Returns true if held. */
function hold(el: HTMLScriptElement | HTMLIFrameElement, src: string): boolean {
  const c = catFor(src);
  if (!c || allowed(c)) return false;
  el.setAttribute("data-consent", c);
  el.setAttribute(HELD, src);
  if (el instanceof HTMLScriptElement) el.type = "text/plain";
  return true;
}

function patchElement(el: HTMLScriptElement | HTMLIFrameElement) {
  const desc = el instanceof HTMLScriptElement ? scriptSrc : iframeSrc;
  Object.defineProperty(el, "src", {
    configurable: true,
    get() {
      return desc.get!.call(this);
    },
    set(v: string) {
      if (!hold(this, String(v))) desc.set!.call(this, v);
    },
  });
  // Never route back through the `src` property here: some engines implement the native src
  // setter via setAttribute, which would recurse.
  const setAttr = el.setAttribute;
  el.setAttribute = function (n: string, v: string) {
    if (n.toLowerCase() === "src" && hold(this as HTMLScriptElement, String(v))) return;
    setAttr.call(this, n, v);
  };
}

function onAdded(node: Node) {
  if (!(node instanceof HTMLScriptElement || node instanceof HTMLIFrameElement)) return;
  if (node.hasAttribute(HELD)) return;
  const src = node.getAttribute("src");
  if (src && hold(node, src)) {
    if (node instanceof HTMLIFrameElement) node.removeAttribute("src");
    // Firefox: stop a parser-inserted script that already started
    node.addEventListener("beforescriptexecute", (e) => e.preventDefault(), { once: true });
  }
}

export function startBlocking(list: { p: string; c: string }[], isAllowed: Allowed) {
  patterns = list.map((t) => ({ p: t.p, c: t.c as CategoryId }));
  allowed = isAllowed;
  const create = doc.createElement;
  doc.createElement = function (this: Document, tag: string, opts?: ElementCreationOptions) {
    const el = create.call(this, tag, opts);
    if (el instanceof HTMLScriptElement || el instanceof HTMLIFrameElement) patchElement(el);
    return el;
  } as typeof doc.createElement;
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach(onAdded);
  }).observe(doc.documentElement, { childList: true, subtree: true });
}

export function setPatterns(list: { p: string; c: string }[]) {
  patterns = list.map((t) => ({ p: t.p, c: t.c as CategoryId }));
}

/** Release everything held whose category is now allowed. */
export function release() {
  doc.querySelectorAll<HTMLElement>("[data-consent]").forEach((el) => {
    const c = el.getAttribute("data-consent") as CategoryId;
    if (!allowed(c)) return;
    if (el instanceof HTMLIFrameElement) {
      const src = el.getAttribute(HELD);
      el.removeAttribute("data-consent");
      if (src) iframeSrc.set!.call(el, src);
      return;
    }
    if (!(el instanceof HTMLScriptElement) || el.type !== "text/plain") return;
    const s = doc.createElement("script");
    for (const a of Array.from(el.attributes)) {
      if (a.name !== "type" && a.name !== HELD && a.name !== "data-consent" && a.name !== "src") s.setAttribute(a.name, a.value);
    }
    const t = el.getAttribute("data-type");
    if (t) s.type = t;
    const src = el.getAttribute(HELD) || el.getAttribute("src");
    if (src) scriptSrc.set!.call(s, src);
    else s.text = el.text;
    el.parentNode?.replaceChild(s, el);
  });
}
