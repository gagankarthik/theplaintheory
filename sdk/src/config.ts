import { frameworkFor } from "./geo";
import type { Framework, PublicConfig } from "./types";

/** Script-tag settings, resolved once at load. */
export interface ScriptSettings {
  siteKey: string;
  api: string;
  configUrl: string;
  /** testing-only geo override (?plain_country / ?plain_region), honoured on localhost or with data-debug */
  country: string | null;
  region: string | null;
}

export function readSettings(script: HTMLScriptElement | null, loc: Location = location): ScriptSettings {
  const siteKey = script?.getAttribute("data-site") || "";
  const origin = script?.src ? new URL(script.src, loc.href).origin : loc.origin;
  const api = (script?.getAttribute("data-api") || origin + "/api/v1").replace(/\/$/, "");
  const debug = !!script?.hasAttribute("data-debug") || /^(localhost|127\.0\.0\.1)$/.test(loc.hostname);
  const qs = new URLSearchParams(debug ? loc.search : "");
  return {
    siteKey,
    api,
    configUrl: script?.getAttribute("data-config-url") || `${api}/config/${encodeURIComponent(siteKey)}`,
    country: qs.get("plain_country"),
    region: qs.get("plain_region"),
  };
}

/** Fetch the published config; the edge (or our API) reports the viewer's location in response headers. */
export async function loadConfig(s: ScriptSettings): Promise<{ cfg: PublicConfig; framework: Framework }> {
  const res = await fetch(s.configUrl + (s.country ? `?country=${encodeURIComponent(s.country)}` : ""), { credentials: "omit" });
  if (!res.ok) throw new Error(`plain-consent: config ${res.status}`);
  const cfg = (await res.json()) as PublicConfig;
  const country = s.country || res.headers.get("x-plain-country") || "";
  const region = s.region || res.headers.get("x-plain-region") || "";
  return { cfg, framework: frameworkFor(country, region, cfg) };
}
