"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { requireProperty } from "@/lib/auth/access";
import { id, verifyChain } from "@/lib/crypto";
import { rightsSchema } from "@/lib/config-schema";
import { DEFAULT_REASK_DAYS, FRAMEWORK_META } from "@/lib/defaults";
import { languageInfo } from "@/lib/i18n/languages";
import { rangeDays } from "@/lib/analytics";
import { evaluateFairness } from "@/lib/fairness";
import { buildConfigVersion } from "@/lib/config-versions";
import { publishConfig, toPublicConfig } from "@/lib/publish";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";
import { auditLiveSite } from "@/lib/site-audit";
import type { SiteAuditResult } from "@/lib/site-audit/types";
import { auditSite, persistConfig } from "@/lib/site-config";
import { heldTrackers, statusOf } from "@/lib/trackers";
import { writeTrackers } from "@/lib/tracker-writes";
import type { BannerConfig, Framework, Tracker } from "@/lib/types";

/* ---------------- site ---------------- */

export async function deleteSite(propertyId: string, confirmDomain: string): Promise<ActionResult> {
  try {
    const ctx = await requireProperty(propertyId, "property:delete");
    const { property, store } = ctx;
    if (confirmDomain.trim().toLowerCase() !== property.domain) return { error: `Type ${property.domain} exactly to confirm.` };
    await auditSite(ctx, "property.deleted", { name: property.name });
    await store.deleteProperty(propertyId);
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app");
  redirect("/app");
}

/* ---------------- banner config ---------------- */

export async function saveConfig(propertyId: string, input: Omit<BannerConfig, "version">): Promise<ActionResult> {
  return persistConfig(propertyId, input, "banner.updated");
}

export async function saveRegions(propertyId: string, regions: BannerConfig["regions"]): Promise<ActionResult> {
  try {
    const { property } = await requireProperty(propertyId, "property:read");
    return persistConfig(propertyId, { ...property.config, regions }, "regions.updated");
  } catch (e) {
    return failure(e);
  }
}

const noticeSchema = z.object({
  rights: rightsSchema,
  reaskAfterRejectDays: z.coerce.number().int("Use a whole number of days.").min(0, "Use 0 to 395 days.").max(395, "Use 0 to 395 days."),
  leakDetection: z.boolean(),
});

/** Rights links, grievance contact, re-ask suppression and leak detection (DPDPA Rule 3, s.6(4)). */
export type NoticeState = (ActionResult & { values?: Record<string, string> }) | null;

export async function saveNoticeSettings(propertyId: string, _: NoticeState, form: FormData): Promise<NoticeState> {
  const values = Object.fromEntries(["rightsUrl", "grievanceEmail", "boardComplaintUrl", "reaskAfterRejectDays"].map((k) => [k, String(form.get(k) ?? "")]));
  try {
    const { property } = await requireProperty(propertyId, "property:write");
    const parsed = noticeSchema.safeParse({
      rights: {
        rightsUrl: String(form.get("rightsUrl") ?? ""),
        grievanceEmail: String(form.get("grievanceEmail") ?? ""),
        boardComplaintUrl: String(form.get("boardComplaintUrl") ?? ""),
      },
      reaskAfterRejectDays: form.get("reaskAfterRejectDays") ?? DEFAULT_REASK_DAYS,
      leakDetection: form.get("leakDetection") === "on",
    });
    if (!parsed.success) {
      const r = invalid(parsed.error);
      // flatten nested rights.* errors onto their field names
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[issue.path.length - 1])] = [issue.message];
      return { ...r, fieldErrors, values };
    }
    const saved = await persistConfig(propertyId, { ...property.config, ...parsed.data }, "notice.updated");
    return saved?.error ? { ...saved, values } : saved;
  } catch (e) {
    return failure(e);
  }
}

export async function publishSite(propertyId: string): Promise<ActionResult> {
  try {
    const ctx = await requireProperty(propertyId, "property:write");
    const { property, org, store } = ctx;
    // The same fairness check the builder shows; enforced here so no client can skip it.
    const fairness = evaluateFairness(property.config, { dpoEmail: org.dpo?.email });
    if (fairness.failures.length) {
      const first = fairness.failures[0];
      const more = fairness.failures.length > 1 ? ` (and ${fairness.failures.length - 1} more)` : "";
      return { error: `Can't publish yet: ${first.title}. ${first.detail}${more}` };
    }
    const dpo = org.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined;
    const { location } = await publishConfig(toPublicConfig(property, dpo));
    // the snapshot keeps the approved inventory only: suggestions and ignored items were never live
    const trackers = heldTrackers(property.trackers);
    const publishedAt = new Date().toISOString();
    // Keep an immutable copy of this version so every receipt can show the notice behind it.
    // Write-once: re-publishing an unchanged version keeps the first snapshot.
    await store.saveConfigVersion(
      buildConfigVersion({ propertyId, version: property.config.version, config: property.config, trackers, publishedAt, publishedBy: ctx.user.id }),
    );
    await store.updateProperty(propertyId, {
      publishedVersion: property.config.version,
      publishedAt,
      published: { config: property.config, trackers },
    });
    await auditSite(ctx, "property.published", { version: property.config.version, fairnessScore: fairness.score });
    revalidatePath(`/app/sites/${propertyId}`, "layout");
    revalidatePath("/app");
    void location;
    return {
      ok: `Your banner is live. Visitors to ${property.domain} now get version ${property.config.version} wherever the Plain Theory script is installed.`,
    };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- trackers ---------------- */

const trackerSchema = z.object({
  name: z.string().trim().min(2, "Name the tracker, e.g. Google Analytics.").max(60),
  category: z.enum(["functional", "analytics", "marketing"], "Pick a category."),
  pattern: z.string().trim().min(4, "The match pattern needs at least 4 characters, e.g. clarity.ms").max(200),
});

export async function addTracker(propertyId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const parsed = trackerSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    let dup = false;
    await writeTrackers(
      propertyId,
      (list) => {
        const same = list.find((t) => t.pattern === parsed.data.pattern);
        dup = !!same && statusOf(same) === "approved";
        if (dup) return list;
        // a scan suggestion or an ignored item with this pattern becomes the approved, hand-named entry
        if (same) return list.map((t) => (t === same ? { ...t, ...parsed.data, status: "approved" as const } : t));
        return [...list, { id: id("trk", 6), ...parsed.data, status: "approved" as const, source: "manual" as const, kind: "script" as const }];
      },
      { action: "tracker.added", metadata: () => ({ name: parsed.data.name, category: parsed.data.category, duplicate: dup }) },
    );
    return dup ? { error: "A tracker with that pattern is already listed." } : { ok: `${parsed.data.name} will be held until visitors consent to ${parsed.data.category}.` };
  } catch (e) {
    return failure(e);
  }
}

const CATEGORY = z.enum(["essential", "functional", "analytics", "marketing"]);

/** Change the category of any tracker; for one in review this sets what approving it will use. */
export async function updateTrackerCategory(propertyId: string, trackerId: string, category: Tracker["category"]): Promise<ActionResult> {
  try {
    const cat = CATEGORY.parse(category);
    await writeTrackers(propertyId, (list) => list.map((t) => (t.id === trackerId ? { ...t, category: cat } : t)), {
      action: "tracker.updated",
      metadata: () => ({ trackerId, category: cat }),
    });
    return { ok: `Moved to ${cat}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function removeTracker(propertyId: string, trackerId: string): Promise<ActionResult> {
  try {
    await writeTrackers(propertyId, (list) => list.filter((t) => t.id !== trackerId), { action: "tracker.removed", metadata: () => ({ trackerId }) });
    return { ok: "Tracker removed. It will run without consent unless another rule holds it." };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Live site check: crawl the site's own saved domain (never an address from the client) and keep the
 * report. Five runs per site per hour.
 */
export async function runSiteAudit(propertyId: string): Promise<SiteAuditResult> {
  try {
    const ctx = await requireProperty(propertyId, "property:write");
    const limit = await rateLimiter("siteAudit").consume(ctx.property.id);
    if (!limit.ok) return { ok: false, error: `This site has been checked 5 times in the last hour. Try again in ${retryAfterText(limit.retryAfterMs)}.` };
    const report = await auditLiveSite({ propertyId: ctx.property.id, domain: ctx.property.domain, runBy: ctx.user.id });
    await ctx.store.saveSiteAudit(ctx.property.id, report);
    const s = report.summary;
    await auditSite(ctx, "site.audit_run", { pages: report.pages.filter((p) => p.kind !== "robots").length, pass: s.pass, warn: s.warn, fail: s.fail, unknown: s.unknown });
    revalidatePath(`/app/sites/${propertyId}/dpdp`);
    return { ok: true, report };
  } catch (e) {
    const r = failure(e);
    return { ok: false, error: r?.error ?? "The check failed. Try again." };
  }
}

export async function addScannedTrackers(propertyId: string, found: Omit<Tracker, "id">[]): Promise<ActionResult> {
  try {
    const clean = found.map((f) => trackerSchema.parse(f));
    let added = 0;
    await writeTrackers(
      propertyId,
      (list) => {
        const fresh = clean.filter((f) => !list.some((t) => t.pattern === f.pattern));
        added = fresh.length;
        return [...list, ...fresh.map((f) => ({ id: id("trk", 6), ...f, status: "approved" as const, source: "scan" as const, kind: "script" as const }))];
      },
      { action: "tracker.added", metadata: () => ({ fromScan: true, added }) },
    );
    return { ok: added ? `Added ${added} tracker${added > 1 ? "s" : ""}.` : "Those trackers were already on the list." };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- consent log ---------------- */

export type ChainCheck =
  | { ok: true; checked: number; head?: string; verifiedAt: string }
  | { ok: false; checked: number; brokenAt?: number; error?: string; verifiedAt: string };

export async function verifyPropertyChain(propertyId: string): Promise<ChainCheck> {
  const verifiedAt = new Date().toISOString();
  try {
    const ctx = await requireProperty(propertyId, "logs:export");
    const result = verifyChain(await ctx.store.listReceipts(propertyId), ctx.property.retentionCheckpoint);
    await auditSite(ctx, "logs.chain_verified", { ok: result.ok, checked: result.checked });
    // Shown as "last verified" on the consent log's chain strip.
    await ctx.store.updateProperty(propertyId, {
      lastChainCheck: { at: verifiedAt, ok: result.ok, checked: result.checked, ...(result.ok ? {} : { brokenAt: result.brokenAt }) },
    });
    return { ...result, verifiedAt };
  } catch (e) {
    return { ok: false, checked: 0, error: failure(e)?.error, verifiedAt };
  }
}

/* ---------------- publish summary ---------------- */

export interface PublishSummary {
  domain: string;
  draftVersion: number;
  liveVersion: number;
  /** plain-language list of what differs from the live banner; the whole banner on a first publish */
  changes: string[];
  /** the notices visitors get, by region */
  notices: { region: string; law: string; model: "opt-in" | "opt-out"; languages: string[] }[];
  /** approved trackers the script holds until the visitor agrees to their category */
  trackersHeld: number;
  categories: string[];
  /** a banner view or consent decision was recorded in the last 30 days, so the script is on the site */
  scriptSeen: boolean;
  /** failing fairness checks; publishing is refused while there are any */
  blocking: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What pressing Publish would put in front of visitors, so the button never acts blind. */
export async function getPublishSummary(propertyId: string): Promise<PublishSummary | { error: string }> {
  try {
    const { property, org, store } = await requireProperty(propertyId, "property:write");
    const draft = property.config;
    const live = property.published?.config;
    const fws = Object.keys(draft.regions) as Framework[];

    const changes: string[] = [];
    if (!live) changes.push("This is the first publish: your whole banner goes live.");
    else {
      if (!same(draft.theme, live.theme)) changes.push("Design: layout, position or colours");
      const reworded = fws.filter((f) => !same(draft.regions[f].copy, live.regions[f]?.copy)).map((f) => FRAMEWORK_META[f].name);
      if (reworded.length) changes.push(`Wording of the ${reworded.join(", ")} notice${reworded.length > 1 ? "s" : ""}`);
      const toggled = fws.filter((f) => draft.regions[f].enabled !== live.regions[f]?.enabled || draft.regions[f].model !== live.regions[f]?.model);
      if (toggled.length) changes.push(`Which regions get a notice, or opt-in vs opt-out: ${toggled.map((f) => FRAMEWORK_META[f].name).join(", ")}`);
      const translated = fws.filter((f) => !same(draft.regions[f].translations, live.regions[f]?.translations) || draft.regions[f].language !== live.regions[f]?.language);
      if (translated.length) changes.push(`Languages of the ${translated.map((f) => FRAMEWORK_META[f].name).join(", ")} notice${translated.length > 1 ? "s" : ""}`);
      if (!same(draft.categories, live.categories)) changes.push("Purposes visitors can choose (categories and their descriptions)");
      if (!same(heldTrackers(property.trackers), property.published?.trackers ?? [])) changes.push("The list of trackers held until consent");
      const behaviour = (["policyUrl", "headless", "googleConsentMode", "expiryDays", "reaskAfterRejectDays", "rights", "leakDetection"] as const).filter((k) => !same(draft[k], live[k]));
      if (behaviour.length) changes.push("Behaviour: policy link, Consent Mode, re-ask timing, rights links or leak detection");
      if (!changes.length) changes.push("Settings were saved again, but nothing visitors see has changed.");
    }

    const days = rangeDays(30);
    const [[latest], counters] = await Promise.all([store.listReceipts(property.id, { limit: 1 }), store.listCounters(property.id, days[0], days[days.length - 1])]);
    const held = heldTrackers(property.trackers);
    const fairness = evaluateFairness(draft, { dpoEmail: org.dpo?.email });

    return {
      domain: property.domain,
      draftVersion: draft.version,
      liveVersion: property.publishedVersion,
      changes,
      notices: fws
        .filter((f) => draft.regions[f].enabled)
        .map((f) => {
          const r = draft.regions[f];
          const codes = [r.language, ...Object.keys(r.translations ?? {}).filter((c) => c !== r.language)];
          return { region: FRAMEWORK_META[f].region, law: FRAMEWORK_META[f].name, model: r.model, languages: codes.map((c) => languageInfo(c)?.name ?? c) };
        }),
      trackersHeld: held.length,
      categories: draft.categories.filter((c) => !c.required).map((c) => c.label),
      scriptSeen: Boolean(latest) || counters.some((c) => c.views > 0),
      blocking: fairness.failures.map((f) => f.title),
    };
  } catch (e) {
    const r = failure(e);
    return { error: r?.error ?? "Couldn't load what would be published." };
  }
}
