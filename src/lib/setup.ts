/**
 * Getting a site live, as one ordered checklist (the Overview's setup guide, the sidebar badge and
 * the sites table), built for the fastest time to a first consent: a new site already has a default
 * banner published and its first scan running in the background (lib/site-launch.ts), and known
 * vendors are categorized automatically. So the steps are: make the banner yours, put the script on
 * the site, see a first consent arrive, then review the few trackers nobody could categorize.
 * Each step is done from data already stored, never from a box someone ticked.
 */

export interface SetupSignals {
  propertyId: string;
  domain: string;
  /** the latest scan finished ("ok") */
  scanned: boolean;
  /**
   * The latest scan while it matters to the checklist: "active" (queued or running, still alive),
   * "failed" (didn't finish), else absent. `eta` is a short phrase such as "about 2 min left".
   */
  scan?: { state: "active" | "failed"; startedAt: string; phase?: string; eta?: string | null; error?: string };
  /** cookies and trackers in the catalog (scanned or added by hand) */
  trackers: number;
  /** of those, how many still wait for a category decision (unknown vendors) */
  toReview: number;
  /** someone saved or published the banner themselves (not only the default published at creation) */
  bannerSaved: boolean;
  published: boolean;
  /** failing fairness checks, which block publishing */
  blocked: number;
  /** the script has loaded on the site (page views counted, or the live check found it) */
  seen: boolean;
  /** at least one consent decision recorded */
  decided: boolean;
}

export type SetupStepId = "banner" | "install" | "decision" | "review";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  done: boolean;
  why: string;
  cta: string;
  href: string;
  /** public docs section that explains the step */
  docs: string;
  /** work on this step is under way (a scan running) or its last attempt failed */
  status?: "running" | "failed";
}

export function setupSteps(s: SetupSignals): SetupStep[] {
  const base = `/app/sites/${s.propertyId}`;
  const found = s.scanned || s.trackers > 0;
  const reviewCount = `${s.toReview} ${s.toReview === 1 ? "tracker" : "trackers"}`;

  const banner: SetupStep = {
    id: "banner",
    title: s.published ? "Make the banner yours" : "Design and publish your banner",
    done: s.bannerSaved && s.published,
    why: s.blocked
      ? `${s.blocked} fairness ${s.blocked === 1 ? "check fails" : "checks fail"}. Fix ${s.blocked === 1 ? "it" : "them"} on the review step, then publish.`
      : s.published
        ? "A default banner is already live, so you can install now. Pick the layout, colours and policy link, then publish: it takes under a minute."
        : "Pick the layout, colours and policy link, then publish. Visitors only ever see a published version.",
    cta: s.blocked ? `Fix ${s.blocked} ${s.blocked === 1 ? "check" : "checks"}` : "Open Banner studio",
    href: s.blocked ? `${base}/banner?tab=review` : `${base}/banner`,
    docs: "/docs#banner",
  };

  const install: SetupStep = {
    id: "install",
    title: "Add the script to your site",
    done: s.seen,
    why: "Paste one script tag first in your site's <head>, or add it through Google Tag Manager. This step completes when the banner loads on your site for the first time.",
    cta: "Get the script",
    href: `${base}/install`,
    docs: "/docs#install",
  };

  const decision: SetupStep = {
    id: "decision",
    title: "Record the first consent",
    done: s.decided,
    why: "Open your site in a private window and choose on the banner. Every choice becomes a tamper-evident receipt in the consent log.",
    cta: "Open the consent log",
    href: `${base}/logs`,
    docs: "/docs#analytics",
  };

  // The scan runs in the background from the moment the site is created; known vendors are already
  // categorized, so this step is only the trackers nobody could identify.
  const review: SetupStep =
    !found && s.scan?.state === "active"
      ? {
          id: "review",
          title: `Scanning ${s.domain}`,
          done: false,
          status: "running",
          why: `${s.scan.phase ?? "Scanning"}${s.scan.eta ? `, ${s.scan.eta}` : ""}. A real browser is visiting your pages as a first-time visitor; known vendors are categorized as they're found. Carry on with the other steps meanwhile.`,
          cta: "View progress",
          href: `${base}/scanner`,
          docs: "/docs#scanner",
        }
      : !found && s.scan?.state === "failed"
        ? {
            id: "review",
            title: "Scan your site",
            done: false,
            status: "failed",
            why: `The last scan didn't finish${s.scan.error ? `: ${s.scan.error.replace(/\.$/, "")}` : ""}. Most failures are temporary, so run it again.`,
            cta: "Run the scan again",
            href: `${base}/scanner`,
            docs: "/docs#scanner",
          }
        : !found
          ? {
              id: "review",
              title: "Scan your site",
              done: false,
              why: `The scanner visits ${s.domain} as a first-time visitor and lists every cookie, stored value and tracker it sets, about 2 to 4 minutes. Known vendors are categorized for you.`,
              cta: "Run a scan",
              href: `${base}/scanner`,
              docs: "/docs#scanner",
            }
          : {
              id: "review",
              title: s.toReview ? `Review ${reviewCount} we couldn't identify` : "Review the cookie catalog",
              done: s.toReview === 0,
              why: s.toReview
                ? "Known vendors were categorized automatically. These are your own or less common ones: pick a category for each, and anything outside Essential waits for consent."
                : "Every tracker found has a category. Check the catalog any time; rescans add new ones here.",
              cta: s.toReview ? `Review ${reviewCount}` : "Open the catalog",
              href: `${base}/trackers`,
              docs: "/docs#blocking",
            };

  return [banner, install, decision, review];
}

export interface SetupProgress {
  steps: SetupStep[];
  done: number;
  total: number;
  /** the first step not done yet; null when the site is fully set up */
  next: SetupStep | null;
  complete: boolean;
}

export function setupProgress(s: SetupSignals): SetupProgress {
  const steps = setupSteps(s);
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done) ?? null;
  return { steps, done, total: steps.length, next, complete: !next };
}
