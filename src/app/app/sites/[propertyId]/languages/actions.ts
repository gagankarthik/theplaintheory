"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "@/lib/action-result";
import { requireProperty } from "@/lib/auth/access";
import { FREE_LANGUAGES, languageInfo } from "@/lib/i18n/languages";
import { draftTranslation } from "@/lib/i18n/notice-drafts";
import { planById } from "@/lib/plans";
import type { BannerConfig, Framework, LanguageCode, NoticeTranslation } from "@/lib/types";
import { languageCodeSchema, translationSchema } from "@/lib/config-schema";
import { persistConfig } from "@/lib/site-config";

const frameworkSchema = z.enum(["gdpr", "ccpa", "dpdpa", "generic"]);

async function load(propertyId: string, framework: string, code: string) {
  const ctx = await requireProperty(propertyId, "property:write");
  const fw = frameworkSchema.parse(framework) as Framework;
  const lang = languageCodeSchema.parse(code) as LanguageCode;
  return { ...ctx, fw, lang };
}

function withTranslation(config: BannerConfig, fw: Framework, lang: LanguageCode, t: NoticeTranslation | undefined) {
  const current = { ...(config.regions[fw].translations ?? {}) };
  if (t) current[lang] = t;
  else delete current[lang];
  const { version, ...rest } = config;
  void version;
  return { ...rest, regions: { ...config.regions, [fw]: { ...config.regions[fw], translations: current } } };
}

/** English source for a region, used when no draft exists for a language or the region isn't DPDPA. */
function starterFrom(config: BannerConfig, fw: Framework): NoticeTranslation {
  return {
    copy: { ...config.regions[fw].copy },
    categories: Object.fromEntries(config.categories.map((c) => [c.id, { label: c.label, description: c.description }])),
    status: "draft",
  };
}

export async function addLanguage(propertyId: string, framework: string, code: string): Promise<ActionResult> {
  try {
    const { property, org, fw, lang } = await load(propertyId, framework, code);
    const info = languageInfo(lang);
    if (!info || lang === "en") return { error: "English is the default copy; it doesn't need a translation." };
    if (!planById(org.plan).limits.indianLanguages && info.eighthSchedule && !FREE_LANGUAGES.includes(lang)) {
      return { error: `${info.name} needs the Starter plan or above. The Free plan includes English and Hindi.` };
    }
    if (property.config.regions[fw].translations?.[lang]) return { error: `${info.name} is already added.` };
    // DPDPA drafts translate the DPDPA wording; other regions start from their own English copy.
    const t = (fw === "dpdpa" || fw === "generic" ? draftTranslation(lang) : null) ?? starterFrom(property.config, fw);
    const r = await persistConfig(propertyId, withTranslation(property.config, fw, lang, t), "language.added", { framework: fw, language: lang });
    if (r?.error) return r;
    revalidatePath(`/app/sites/${propertyId}/languages`);
    return { ok: `${info.name} added as a draft. Have a native speaker review it before marking it reviewed.` };
  } catch (e) {
    return failure(e);
  }
}

export async function saveTranslation(propertyId: string, framework: string, code: string, input: NoticeTranslation): Promise<ActionResult> {
  try {
    const { property, fw, lang } = await load(propertyId, framework, code);
    const parsed = translationSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { error: `${issue.path.join(" › ")}: ${issue.message}` };
    }
    const prev = property.config.regions[fw].translations?.[lang];
    if (!prev) return { error: "That language isn't added to this notice." };
    // Any change to reviewed wording sends it back to draft: a review covers the exact text reviewed.
    const changed = JSON.stringify({ c: prev.copy, k: prev.categories }) !== JSON.stringify({ c: parsed.data.copy, k: parsed.data.categories });
    const next: NoticeTranslation = changed
      ? { copy: parsed.data.copy, categories: parsed.data.categories, status: "draft" }
      : { ...prev, copy: parsed.data.copy, categories: parsed.data.categories };
    const r = await persistConfig(propertyId, withTranslation(property.config, fw, lang, next), "language.updated", { framework: fw, language: lang });
    if (r?.error) return r;
    return { ok: changed && prev.status === "reviewed" ? "Saved. The wording changed, so it's back to draft until reviewed again." : "Translation saved." };
  } catch (e) {
    return failure(e);
  }
}

export async function markReviewed(propertyId: string, framework: string, code: string, reviewer: string): Promise<ActionResult> {
  try {
    const { property, fw, lang, user } = await load(propertyId, framework, code);
    const name = z.string().trim().min(2, "Enter the reviewer's name.").max(120).safeParse(reviewer);
    if (!name.success) return { error: name.error.issues[0].message };
    const prev = property.config.regions[fw].translations?.[lang];
    if (!prev) return { error: "That language isn't added to this notice." };
    const next: NoticeTranslation = { ...prev, status: "reviewed", reviewedBy: `${name.data} (recorded by ${user.email})`, reviewedAt: new Date().toISOString() };
    const r = await persistConfig(propertyId, withTranslation(property.config, fw, lang, next), "language.reviewed", { framework: fw, language: lang, reviewer: name.data });
    if (r?.error) return r;
    return { ok: `${languageInfo(lang)?.name} marked as reviewed by ${name.data}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function removeLanguage(propertyId: string, framework: string, code: string): Promise<ActionResult> {
  try {
    const { property, fw, lang } = await load(propertyId, framework, code);
    const r = await persistConfig(propertyId, withTranslation(property.config, fw, lang, undefined), "language.removed", { framework: fw, language: lang });
    if (r?.error) return r;
    return { ok: `${languageInfo(lang)?.name} removed. Visitors who read it will see the default language.` };
  } catch (e) {
    return failure(e);
  }
}
