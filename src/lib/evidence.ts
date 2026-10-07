import "server-only";
import { groupLeaks } from "./analytics";
import { anchorsFor, type DayAnchor } from "./anchors";
import { sha256, verifyChain } from "./crypto";
import { FRAMEWORK_META } from "./defaults";
import { evaluateFairness, type FairnessCheck } from "./fairness";
import { languageInfo } from "./i18n/languages";
import type { Plan } from "./plans";
import { dpdpReadiness, type ReadinessItem } from "./readiness";
import { regionLabel } from "./regions";
import type { Store } from "./store";
import type { BannerConfig, Framework, Organization, Property, User } from "./types";
import { heldTrackers } from "./trackers";

/**
 * Compliance Evidence Pack: everything an auditor needs about one site's consent, in one document.
 * The pack is a plain JSON object; its SHA-256 digest over a canonical serialisation is printed on
 * every rendering, so the pack itself is tamper-evident.
 */

export interface EvidencePack {
  format: "plaintheory.evidence/1";
  generatedAt: string;
  generatedBy: { name: string; email: string };
  organization: { name: string; dataRegion: string; dpo: { name: string; email: string; address?: string } | null };
  site: { name: string; domain: string; siteKey: string };
  plan: { name: string; logRetentionDays: number };
  chain: { ok: boolean; checked: number; brokenAt?: number; head: string | null; verifiedAt: string };
  /** receipts removed by the retention job; verification starts from this checkpoint */
  retention: { logRetentionDays: number; checkpoint: { seq: number; hash: string; removedThrough: string; removedCount: number; at: string } | null };
  anchors: DayAnchor[];
  banner: {
    version: number | null;
    publishedAt: string | null;
    layout: string;
    equalButtons: boolean;
    googleConsentMode: boolean;
    reaskAfterRejectDays: number;
    leakDetection: boolean;
    rights: BannerConfig["rights"] | null;
    policyUrl: string;
    regions: {
      framework: Framework;
      name: string;
      model: string;
      title: string;
      body: string;
      buttons: { accept: string; reject: string; customise: string; save: string };
      languages: { code: string; name: string; status: string; reviewedBy?: string; reviewedAt?: string }[];
    }[];
    purposes: { id: string; label: string; description: string; required: boolean; dataItems: string[]; retention: string | null }[];
  };
  trackers: { name: string; category: string; pattern: string }[];
  signals: { receipts: number; gpcHonoured: number; automated: number; byFramework: Record<string, number>; byLanguage: Record<string, number> };
  leaks: { days: 30; requests: number; groups: { url: string; category: string; page: string; count: number; lastSeen: string }[] };
  fairness: { score: number; checks: Pick<FairnessCheck, "id" | "framework" | "severity" | "title" | "detail" | "ref">[] };
  readiness: { percent: number; items: Pick<ReadinessItem, "id" | "title" | "ref" | "severity" | "detail">[] };
}

/** JSON with object keys sorted at every level, so the same pack always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export const evidenceDigest = (pack: EvidencePack) => sha256(canonicalJson(pack));

export async function buildEvidencePack(input: { property: Property; org: Organization; plan: Plan; user: User; store: Store }): Promise<{ pack: EvidencePack; digest: string }> {
  const { property, org, plan, user, store } = input;
  const now = new Date();
  const receipts = (await store.listReceipts(property.id)).sort((a, b) => a.seq - b.seq);
  const chain = verifyChain(receipts, property.retentionCheckpoint);
  const { anchors } = await anchorsFor(property.id, 30, now);
  const leaks = await store.listLeaks(property.id, new Date(now.getTime() - 30 * 86_400_000).toISOString());
  // Evidence describes what visitors actually saw: the published snapshot, not unpublished drafts.
  const live = property.published?.config ?? property.config;
  const liveTrackers = heldTrackers(property.published?.trackers ?? property.trackers);
  const fairness = evaluateFairness(live, { dpoEmail: org.dpo?.email });
  const readiness = dpdpReadiness(property, org, plan);

  const byFramework: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  let gpc = 0;
  let automated = 0;
  for (const r of receipts) {
    byFramework[r.framework] = (byFramework[r.framework] ?? 0) + 1;
    if (r.language) byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;
    if (r.gpc) gpc += 1;
    if (r.automated) automated += 1;
  }

  const pack: EvidencePack = {
    format: "plaintheory.evidence/1",
    generatedAt: now.toISOString(),
    generatedBy: { name: user.name, email: user.email },
    organization: { name: org.name, dataRegion: regionLabel(org.dataRegion), dpo: org.dpo ? { ...org.dpo } : null },
    site: { name: property.name, domain: property.domain, siteKey: property.siteKey },
    plan: { name: plan.name, logRetentionDays: plan.logRetentionDays },
    chain: {
      ok: chain.ok,
      checked: chain.checked,
      brokenAt: chain.ok ? undefined : chain.brokenAt,
      head: chain.ok ? (chain.head ?? null) : null,
      verifiedAt: now.toISOString(),
    },
    retention: { logRetentionDays: plan.logRetentionDays, checkpoint: property.retentionCheckpoint ? { ...property.retentionCheckpoint } : null },
    anchors,
    banner: {
      version: property.publishedVersion || null,
      publishedAt: property.publishedAt ?? null,
      layout: live.theme.layout,
      equalButtons: live.theme.equalButtons,
      googleConsentMode: live.googleConsentMode,
      reaskAfterRejectDays: live.reaskAfterRejectDays ?? 180,
      leakDetection: live.leakDetection ?? true,
      rights: live.rights ?? null,
      policyUrl: live.policyUrl,
      regions: (Object.keys(live.regions) as Framework[])
        .filter((f) => live.regions[f].enabled)
        .map((f) => {
          const r = live.regions[f];
          return {
            framework: f,
            name: FRAMEWORK_META[f].name,
            model: r.model,
            title: r.copy.title,
            body: r.copy.body,
            buttons: { accept: r.copy.acceptAll, reject: r.copy.rejectAll, customise: r.copy.customize, save: r.copy.save },
            languages: Object.entries(r.translations ?? {}).map(([code, t]) => ({
              code,
              name: languageInfo(code)?.name ?? code,
              status: t!.status,
              reviewedBy: t!.reviewedBy,
              reviewedAt: t!.reviewedAt,
            })),
          };
        }),
      purposes: live.categories.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        required: c.required,
        dataItems: c.dataItems ?? [],
        retention: c.retention ?? null,
      })),
    },
    trackers: liveTrackers.map((t) => ({ name: t.name, category: t.category, pattern: t.pattern })),
    signals: { receipts: receipts.length, gpcHonoured: gpc, automated, byFramework, byLanguage },
    leaks: {
      days: 30,
      requests: leaks.length,
      groups: groupLeaks(leaks, liveTrackers)
        .slice(0, 25)
        .map((g) => ({ url: g.url, category: g.category, page: g.page, count: g.count, lastSeen: g.lastSeen })),
    },
    fairness: {
      score: fairness.score,
      checks: fairness.checks.map(({ id, framework, severity, title, detail, ref }) => ({ id, framework, severity, title, detail, ref })),
    },
    readiness: {
      percent: readiness.percent,
      items: readiness.items.map(({ id, title, ref, severity, detail }) => ({ id, title, ref, severity, detail })),
    },
  };
  return { pack, digest: evidenceDigest(pack) };
}
