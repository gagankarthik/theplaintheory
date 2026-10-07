/**
 * Code samples for the docs, built from the same source as the dashboard's Install page
 * (src/lib/install-snippets.ts), with placeholder values, so the two never disagree.
 * Every tab is the same script tag; only where you paste it differs.
 */

import { installMethods, SDK_URL } from "@/lib/install-snippets";

/** The working CDN (cdn.theplaintheory.in has no DNS record yet). */
export const CDN = SDK_URL;
const KEY = "pk_live_YOUR_SITE_KEY";

type Snippet = { label: string; title: string; language: string; code: string };

const LANGUAGE: Record<string, string> = { nextjs: "tsx", vue: "ts" };

/** Install: the script tag first in <head>, per stack. */
export const INSTALL_SNIPPETS: Snippet[] = installMethods({ siteKey: KEY, src: CDN }).map((m) => ({
  label: m.label,
  title: m.file,
  language: LANGUAGE[m.id] ?? "html",
  code: m.code,
}));
