/**
 * Getting a site live, as one ordered checklist, used by the overview's setup guide, the sidebar's
 * progress card and the sites table. The order is the real dependency chain every CMP follows:
 * find what the site sets, sort it, design the notice, publish it, put the script on the site, see
 * it work. Each step is done from data already stored, never from a box someone ticked.
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
  /** of those, how many still wait for a category decision */
  toReview: number;
  /** the banner was saved at least once (config version moved past the default) */
  bannerEdited: boolean;
  published: boolean;
  /** failing fairness checks, which block publishing */
  blocked: number;
  /** the script has loaded on the site (page views counted, or the live check found it) */
  seen: boolean;
  /** at least one consent decision recorded */
  decided: boolean;
}

export type SetupStepId = "scan" | "review" | "banner" | "publish" | "install" | "decision";

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
  const scanStep: SetupStep =
    !found && s.scan?.state === "active"
      ? {
          id: "scan",
          title: `Scanning ${s.domain}`,
          done: false,
          status: "running",
          why: `${s.scan.phase ?? "Scanning"}${s.scan.eta ? `, ${s.scan.eta}` : ""}. A real browser is visiting your pages as a first-time visitor. You can design your banner meanwhile; this ticks itself off when the scan finishes.`,
          cta: "View progress",
          href: `${base}/scanner`,
          docs: "/docs#scanner",
        }
      : !found && s.scan?.state === "failed"
        ? {
            id: "scan",
            title: "Scan your site",
            done: false,
            status: "failed",
            why: `The last scan didn't finish${s.scan.error ? `: ${s.scan.error.replace(/\.$/, "")}` : ""}. Most failures are temporary, so run it again.`,
            cta: "Run the scan again",
            href: `${base}/scanner`,
            docs: "/docs#scanner",
          }
        : {
            id: "scan",
            title: "Scan your site",
            done: found,
            why: `The scanner visits ${s.domain} as a first-time visitor and lists every cookie, stored value and tracker it sets. It takes about 2 to 4 minutes.`,
            cta: "Run a scan",
            href: `${base}/scanner`,
            docs: "/docs#scanner",
          };
  return [
    scanStep,
    {
      id: "review",
      title: s.toReview ? `Review ${s.toReview} ${s.toReview === 1 ? "cookie" : "cookies"}` : "Review the cookies found",
      done: found && s.toReview === 0,
      why: "Confirm each cookie's category. Anything outside Essential is held until the visitor allows its category.",
      cta: s.toReview ? `Review ${s.toReview} ${s.toReview === 1 ? "cookie" : "cookies"}` : "Open the cookie list",
      href: `${base}/trackers`,
      docs: "/docs#blocking",
    },
    {
      id: "banner",
      title: "Design your banner",
      done: s.bannerEdited,
      why: "Pick the layout, colours and wording. The fairness check keeps Reject as easy as Accept.",
      cta: "Open the banner",
      href: `${base}/banner`,
      docs: "/docs#banner",
    },
    {
      id: "publish",
      title: "Publish the banner",
      done: s.published,
      why: s.blocked
        ? `${s.blocked} fairness ${s.blocked === 1 ? "check fails" : "checks fail"}. Fix ${s.blocked === 1 ? "it" : "them"} on the review step, then publish.`
        : "Publishing sends the banner to visitors. They only ever see a published version, never a draft.",
      cta: s.blocked ? `Fix ${s.blocked} ${s.blocked === 1 ? "check" : "checks"}` : "Review and publish",
      href: `${base}/banner?tab=review`,
      docs: "/docs#banner",
    },
    {
      id: "install",
      title: "Add the script to your site",
      done: s.seen,
      why: "Paste one script tag in your site's <head>. This step completes when the banner loads on your site for the first time.",
      cta: "Get the script",
      href: `${base}/install`,
      docs: "/docs#install",
    },
    {
      id: "decision",
      title: "Record the first consent",
      done: s.decided,
      why: "Open your site in a private window and choose on the banner. Every choice becomes a tamper-evident receipt.",
      cta: "Open the consent log",
      href: `${base}/logs`,
      docs: "/docs#analytics",
    },
  ];
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
