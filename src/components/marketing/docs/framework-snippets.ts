/**
 * Code samples for the docs, built from the same source as the dashboard's Install page
 * (src/lib/install-snippets.ts, src/app/app/sites/[propertyId]/install/page.tsx), with a placeholder
 * site key, so the two never disagree. Every tab is the same script tag; only where you paste it differs.
 */

import { CDN_ORIGIN, installMethods, SDK_URL } from "@/lib/install-snippets";
import { publicUrl } from "@/lib/site";

/** Where the SDK is served from. */
export const CDN = SDK_URL;
/** Placeholder in the shape of a real site key (pk_ + 16 characters). */
export const KEY = "pk_YOUR_SITE_KEY";
/** The consent API every customer tag points at. */
export const API = `${publicUrl}/api/v1`;
/** Published configs sit on the CDN when publishing writes there; the dashboard then adds data-config-url. */
const CONFIG_URL = process.env.PUBLISH_DRIVER === "s3" ? `${CDN_ORIGIN}/c/${KEY}.json` : undefined;

type Snippet = { label: string; title: string; language: string; code: string };

const LANGUAGE: Record<string, string> = { nextjs: "tsx", vue: "ts" };

/** Install: the script tag first in <head>, per stack, with the attributes the dashboard's tag carries. */
export const INSTALL_SNIPPETS: Snippet[] = installMethods({ siteKey: KEY, src: CDN, api: API, configUrl: CONFIG_URL, gcm: true }).map((m) => ({
  label: m.label,
  title: m.file,
  language: LANGUAGE[m.id] ?? "html",
  code: m.code,
}));
