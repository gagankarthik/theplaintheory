import type { CategoryId, Cats } from "../types";
import { CSS } from "./styles";
import { bannerHtml, fabHtml, prefsHtml, type RenderInput, type View } from "./templates";

export type { RenderInput, View };

/**
 * Banner + preference centre UI in a closed Shadow DOM, so host-page CSS can't leak in or out.
 * Stateless: renders from (config, framework, categories, view, language) and reports intent via handlers.
 *
 * Accessibility (WCAG 2.1 AA):
 *  - bar/toast: role="region" landmark, no focus trap, so the page stays usable (2.1.2)
 *  - modal + preferences: role="dialog" aria-modal, focus moved in, trapped, restored on close (2.4.3)
 *  - toggles: role="switch" + aria-checked, labelled by the category (4.1.2)
 *  - category rows and "Show more": disclosure buttons with aria-expanded/aria-controls
 *  - controls at least 24×24 px (2.5.8), visible focus ring (2.4.7), Escape closes preferences
 *  - lang/dir from the notice language (3.1.2); prefers-reduced-motion removes animation (2.3.3)
 */
export interface UiHandlers {
  accept(): void;
  reject(): void;
  save(c: Cats): void;
  /** preferences closed without a decision */
  close(): void;
  /** visitor picked a notice language in the preference centre */
  lang?(code: string): void;
}

const focusables = (el: Element) => Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden]),a[href],select"));

export function createUi() {
  let host: HTMLElement | null = null;
  let root!: ShadowRoot;
  let view: View = "none";
  /** element to return focus to when the preferences dialog closes */
  let returnTo: HTMLElement | null = null;
  let onKey: ((e: KeyboardEvent) => void) | null = null;

  function mount() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "plain-consent";
    root = host.attachShadow({ mode: "closed" });
    document.body.appendChild(host);
  }

  function render(input: RenderInput, h: UiHandlers) {
    mount();
    const hadFocus = !!root.activeElement;
    const prev = view;
    view = input.view;
    if (view === "prefs" && prev !== "prefs") returnTo = (root.activeElement as HTMLElement | null) || (document.activeElement as HTMLElement | null);

    const html = view === "banner" ? bannerHtml(input) : view === "prefs" ? prefsHtml(input) : view === "fab" && input.fab ? fabHtml(input) : "";
    root.innerHTML = html ? `<style>${CSS}</style>${html}` : "";

    const draft: Cats = { ...input.cats, essential: true };
    root.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.onclick = () => {
        const cat = b.getAttribute("data-c") as CategoryId | null;
        if (cat) {
          draft[cat] = !draft[cat];
          b.setAttribute("aria-checked", String(draft[cat]));
          return;
        }
        const panel = b.getAttribute("data-x");
        if (panel) {
          const open = b.getAttribute("aria-expanded") !== "true";
          b.setAttribute("aria-expanded", String(open));
          root.getElementById(panel)!.hidden = !open;
          return;
        }
        const a = b.getAttribute("data-a");
        if (a === "more") {
          const open = b.getAttribute("aria-expanded") !== "true";
          b.setAttribute("aria-expanded", String(open));
          b.textContent = open ? "Show less" : "Show more";
          root.getElementById("pt-i")!.classList.toggle("op", open);
        } else if (a === "accept") h.accept();
        else if (a === "reject") h.reject();
        else if (a === "save") h.save(draft);
        else if (a === "close") h.close();
        else if (a === "prefs") render({ ...input, view: "prefs" }, h);
      };
    });

    // Language picker: re-render in place, keeping toggles the visitor already changed.
    const select = root.querySelector<HTMLSelectElement>("select[data-l]");
    if (select) {
      select.onchange = () => {
        h.lang?.(select.value);
        render({ ...input, cats: draft, lang: select.value }, h);
        root.querySelector<HTMLElement>("select[data-l]")?.focus();
      };
    }

    // "Show more" only when the intro is actually clamped.
    const intro = root.getElementById("pt-i");
    const more = root.querySelector<HTMLElement>('[data-a="more"]');
    if (intro && more) requestAnimationFrame(() => (more.hidden = intro.scrollHeight <= intro.clientHeight + 1));

    const dialog = root.querySelector<HTMLElement>('[aria-modal="true"]');
    if (dialog && !select?.matches(":focus")) {
      (dialog.querySelector<HTMLElement>(view === "prefs" ? ".ex" : "button") || focusables(dialog)[0])?.focus();
    } else if (!dialog && (prev === "prefs" || hadFocus)) {
      // Leaving a dialog: restore focus to where it came from, else to the Privacy choices button.
      const back = returnTo && returnTo.isConnected && returnTo !== document.body && returnTo !== host ? returnTo : null;
      (back || root.querySelector<HTMLElement>("button"))?.focus();
    }

    if (onKey) root.removeEventListener("keydown", onKey as EventListener);
    onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && view === "prefs") {
        e.stopPropagation();
        h.close();
      } else if (e.key === "Tab" && dialog) {
        const f = focusables(dialog);
        const i = f.indexOf(root.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          f[f.length - 1].focus();
          e.preventDefault();
        } else if (!e.shiftKey && i === f.length - 1) {
          f[0].focus();
          e.preventDefault();
        }
      }
    };
    root.addEventListener("keydown", onKey as EventListener);
  }

  return { render, current: () => view };
}
