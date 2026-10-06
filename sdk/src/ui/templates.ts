import { isRtl, langName } from "../lang";
import type { CategoryId, Cats, Framework, NoticeTranslation, PublicConfig, RegionRule } from "../types";
import { FONTS } from "./styles";

/** Pure HTML templates for each view. Every interpolated value is escaped. */

export type View = "banner" | "prefs" | "fab" | "none";

export interface RenderInput {
  cfg: PublicConfig;
  framework: Framework;
  cats: Cats;
  view: View;
  /** show the persistent "Privacy choices" button after a decision */
  fab: boolean;
  /** translation to show; undefined = the region's default copy */
  lang?: string;
}

export const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
export const safeUrl = (u: string | undefined) => (u && /^https?:\/\//i.test(u) ? u : "");

const ruleFor = (cfg: PublicConfig, f: Framework): RegionRule => (cfg.regions[f] || cfg.regions.generic)!;

const BADGE: Partial<Record<Framework, string>> = { gdpr: "GDPR", ccpa: "CCPA", dpdpa: "DPDPA" };

/** Copy and categories for the chosen language, falling back to the region default. */
function localize({ cfg, framework, lang }: RenderInput) {
  const rule = ruleFor(cfg, framework);
  const tr = lang ? (rule.translations as Record<string, NoticeTranslation | undefined> | undefined)?.[lang] : undefined;
  const code = tr ? lang! : rule.language;
  return {
    rule,
    copy: tr?.copy ?? rule.copy,
    code,
    translated: !!tr,
    categories: cfg.categories.map((k) => ({ ...k, ...(tr?.categories?.[k.id] ?? {}) })),
  };
}

/* ---------- colour safety: theme colours come from the dashboard, text must stay readable ---------- */

function lum(hex: string) {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return -1;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Keep `fg` if it reads at 4.5:1 on `bg`; otherwise use white or ink, whichever reads better. */
function readable(fg: string, bg: string) {
  const b = lum(bg);
  if (b < 0 || ratio(lum(fg), b) >= 4.5) return fg;
  return ratio(1, b) >= ratio(lum("#0b1020"), b) ? "#fff" : "#0b1020";
}

function themeVars(t: PublicConfig["theme"]) {
  const r = Math.min(Math.max(t.radius, 4), 24);
  return `--bg:${t.background};--fg:${readable(t.text, t.background)};--ac:${t.accent};--act:${readable(t.accentText, t.accent)};--r:${r}px;--f:${FONTS[t.font] || FONTS.system}`;
}

/* ---------- parts ---------- */

const svg = (d: string, w = 16) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const SHIELD = svg("M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6zM9 12l2 2 4-4");
const CHEVRON = svg("M9 6l6 6-6 6", 14);
const CLOSE = svg("M6 6l12 12M18 6L6 18");

const btn = (action: string, label: string, cls: string) => `<button type="button" data-a="${action}" class="${cls}">${esc(label)}</button>`;

/** Reject and accept carry equal weight when `equal` (required for GDPR/DPDPA: no dark patterns). */
const choices = (c: RegionRule["copy"], equal: boolean) => btn("reject", c.rejectAll, equal ? "p" : "s") + btn("accept", c.acceptAll, "p");

function head(id: string, title: string, framework: Framework, extra = "") {
  const badge = BADGE[framework] ? `<span class="bd">${BADGE[framework]} notice</span>` : "";
  return `<div class="hd"><h2 id="${id}">${esc(title)}</h2>${badge}${extra}</div>`;
}

function shell(cfg: PublicConfig, code: string, cls: string, inner: string) {
  return `<div class="w ${cls}" style="${themeVars(cfg.theme)}" lang="${esc(code)}" dir="${isRtl(code) ? "rtl" : "ltr"}">${inner}</div>`;
}

const link = (href: string, label: string) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}<span class="sr"> (opens in a new tab)</span></a>`;

/* ---------- views ---------- */

export function bannerHtml(input: RenderInput): string {
  const { cfg, framework } = input;
  const t = cfg.theme;
  const { copy: c, code } = localize(input);
  const layout = t.layout === "modal" ? "modal" : t.layout === "toast" ? "toast" : "bar";
  const role = layout === "modal" ? 'role="dialog" aria-modal="true"' : 'role="region"';
  const policyUrl = safeUrl(cfg.policyUrl);
  const policy = policyUrl ? link(policyUrl, c.policyLabel) : "";
  return shell(
    cfg,
    code,
    `${layout} ${esc(t.position)}`,
    `<div class="b" ${role} aria-labelledby="pt-t" aria-describedby="pt-d">
<div class="tx">${head("pt-t", c.title, framework)}<p id="pt-d">${esc(c.body)} ${policy}</p></div>
<div class="bt">${btn("prefs", c.customize, "s c")}${choices(c, t.equalButtons)}</div></div>`,
  );
}

/** DPDPA s.6(4) and Rule 3: withdrawal, rights, grievance, the Board and the DPO, in one place. */
function rightsHtml(cfg: PublicConfig) {
  const r = cfg.rights || {};
  const items = [
    safeUrl(r.rightsUrl) && `<li>${link(r.rightsUrl!, "Access, correct or erase your data")}</li>`,
    r.grievanceEmail && `<li>Grievances: <a href="mailto:${esc(r.grievanceEmail)}">${esc(r.grievanceEmail)}</a></li>`,
    safeUrl(r.boardComplaintUrl) && `<li>${link(r.boardComplaintUrl!, "Complain to the Data Protection Board of India")}</li>`,
    cfg.dpo && `<li>Data Protection Officer: ${esc(cfg.dpo.name)}, <a href="mailto:${esc(cfg.dpo.email)}">${esc(cfg.dpo.email)}</a></li>`,
  ].filter(Boolean);
  return `<section class="rt" aria-labelledby="pt-r"><h3 id="pt-r">Your rights</h3><p>You can withdraw consent at any time, as easily as you gave it, from the Privacy choices button on every page.</p>${
    items.length ? `<ul>${items.join("")}</ul>` : ""
  }</section>`;
}

function languagePicker(input: RenderInput, rule: RegionRule, code: string) {
  const keys = Object.keys(rule.translations || {});
  if (!keys.length) return "";
  const opts = [rule.language, ...keys.filter((k) => k !== rule.language)]
    .map((k) => `<option value="${esc(k)}"${k === code ? " selected" : ""}>${esc(langName(k))}</option>`)
    .join("");
  return `<label class="lg"><span class="sr">Language</span><select data-l="1">${opts}</select></label>`;
}

export function prefsHtml(input: RenderInput): string {
  const { cfg, framework, cats } = input;
  const { rule, copy: c, code, translated, categories } = localize(input);
  const dpdpa = framework === "dpdpa";
  const rows = categories
    .map((k) => {
      const id = `pt-${k.id}`;
      const on = k.required || cats[k.id as CategoryId];
      const control = k.required
        ? `<span class="on">Always Active</span>`
        : `<button type="button" class="sw" role="switch" data-c="${k.id}" aria-labelledby="${id}" aria-checked="${on}"></button>`;
      const data = k.dataItems?.length
        ? `<p class="k">Data collected</p><ul class="di">${k.dataItems.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
        : "";
      const keep = k.retention ? `<p class="k">Kept for <span>${esc(k.retention)}</span></p>` : "";
      return `<li><div class="rw"><button type="button" class="ex" id="${id}" data-x="${id}-p" aria-expanded="false" aria-controls="${id}-p">${CHEVRON}<span>${esc(k.label)}</span></button>${control}</div><div class="pn" id="${id}-p" hidden><p>${esc(k.description)}</p>${data}${keep}</div></li>`;
    })
    .join("");
  // The English guidance sentence is only added to the English default, never to a translation.
  const extra = dpdpa && !translated ? " Each purpose below lists the data it uses and how long it is kept. Turn on only the ones you agree to." : "";
  // English footer labels are fixed for clarity; translated notices use their own words.
  const L = translated ? [c.rejectAll, c.save, c.acceptAll] : ["Reject All", "Save My Preferences", "Accept All"];
  const eq = cfg.theme.equalButtons ? "p" : "s";
  return shell(
    cfg,
    code,
    "modal pf",
    `<div class="b" role="dialog" aria-modal="true" aria-labelledby="pt-t" aria-describedby="pt-i">
${head("pt-t", "Customise Consent Preferences", framework, languagePicker(input, rule, code) + `<button type="button" class="x" data-a="close" aria-label="Close preferences">${CLOSE}</button>`)}
<div class="sc"><div class="in"><p id="pt-i" class="cl">${esc(c.body)}${extra}</p><button type="button" class="mo" data-a="more" aria-controls="pt-i" aria-expanded="false">Show more</button></div>
<ul class="ac">${rows}</ul>${dpdpa ? rightsHtml(cfg) : ""}</div>
<div class="bt">${btn("reject", L[0], eq)}${btn("save", L[1], "s")}${btn("accept", L[2], "p")}</div>
<p class="pw">Powered by <a href="https://theplaintheory.com" target="_blank" rel="noopener">Plain Theory</a></p></div>`,
  );
}

export function fabHtml(input: RenderInput): string {
  const { code } = localize(input);
  return shell(input.cfg, code, input.cfg.theme.fabSide == "right" ? "fab r" : "fab", `<button type="button" data-a="prefs" aria-haspopup="dialog">${SHIELD}<span class="l">Privacy choices</span></button>`);
}
