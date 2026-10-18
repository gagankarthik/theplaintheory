import "server-only";
import { after } from "next/server";
import { id } from "./crypto";
import { requestCrawl } from "./crawler";
import { publishProperty } from "./publish-site";
import type { Store } from "./store/types";
import { candidatesFrom, mergeScan, trackerPatch } from "./trackers";
import type { Organization, Property } from "./types";

/**
 * A new site, ready to use as soon as its script is pasted (time to first consent):
 *  - the default banner is published now, so installing the script shows a banner straight away;
 *  - the scan starts in the background (after the response) and its known vendors are categorized
 *    automatically (lib/trackers.ts mergeScan), so nothing waits on a line-by-line review.
 * A publish the fairness check refuses (say, no grievance contact yet) is left to the owner: the
 * setup checklist's first step publishes when they save their banner.
 */
export async function launchNewSite(store: Store, property: Property, org: Pick<Organization, "id" | "dpo">, actor: { userId: string; email: string }) {
  const published = await publishProperty(store, property, org, actor, { automatic: true }).catch((e) => {
    console.error("[site-launch] default publish failed", property.id, e);
    return null;
  });
  if (published && !published.ok) console.warn("[site-launch] default banner not published:", published.error);
  if (published?.ok) await store.updateProperty(property.id, { defaultPublished: true });

  after(async () => {
    try {
      const report = await requestCrawl({ propertyId: property.id, domain: property.domain, runBy: actor.email });
      // A headless crawl is merged by the crawler when it finishes; an in-process scan is done now.
      if (report.engine === "fetch" && report.status === "ok") {
        const fresh = await store.getProperty(property.id);
        if (!fresh) return;
        const merged = mergeScan(fresh.trackers, candidatesFrom(report.findings), { now: report.finishedAt, newId: () => id("trk", 6) });
        await store.updateProperty(property.id, trackerPatch(fresh, merged.trackers));
      }
    } catch (e) {
      console.error("[site-launch] first scan failed to start", property.id, e);
    }
  });
}
