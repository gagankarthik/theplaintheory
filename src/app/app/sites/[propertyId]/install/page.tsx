import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/shell/page-header";
import { CodeBlock } from "@/components/app/configure/code-block";
import { CopyField } from "@/components/app/configure/copy-field";
import { LearnMore } from "@/components/app/configure/learn-more";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { formatInt, rangeDays } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { bareDomain } from "@/lib/consent";
import { publicUrl } from "@/lib/site";
import { CDN_ORIGIN, SDK_URL, installMethods } from "@/lib/install-snippets";
import { InstallCheck, InstallMethods } from "@/components/app/sites/install-methods";

export const metadata: Metadata = { title: "Install" };

function Step({ n, title, description, children }: { n: number; title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card as="li" aria-labelledby={`step-${n}-h`}>
      <CardHeader
        titleId={`step-${n}-h`}
        icon={
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border border-boundary text-xs font-semibold tabular-nums text-ink-2">
            {n}
          </span>
        }
        title={
          <>
            <span className="sr-only">Step {n}: </span>
            {title}
          </>
        }
        description={description}
      />
      <CardBody className="space-y-4 text-sm text-ink-2">{children}</CardBody>
    </Card>
  );
}

/** A folded section for what most installs never need. */
function More({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block text-sm text-ink-3">{description}</span>
        </span>
        <IconArrowRight size={16} aria-hidden className="shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <div className="space-y-4 border-t border-line px-5 py-5 text-sm text-ink-2 sm:px-6">{children}</div>
    </details>
  );
}

/**
 * Install, as connection set-ups in enterprise tools read: first the status (is the script live on
 * the site?) with the page's one primary action, then two steps (pick your platform and paste the
 * snippet; check it), and what few installs need folded at the foot. Everything a customer copies
 * names the public service, never this environment's own address.
 */
export default async function InstallPage(props: PageProps<"/app/sites/[propertyId]/install">) {
  const { propertyId } = await props.params;
  const { property, store, role } = await requireProperty(propertyId);
  const api = `${publicUrl}/api/v1`;
  // configs reach the CDN when publishing writes to S3; otherwise the consent API serves them
  const onCdn = process.env.PUBLISH_DRIVER === "s3";
  const published = property.publishedVersion > 0;
  const dirty = property.config.version !== property.publishedVersion;
  const domain = bareDomain(property.domain);
  const base = `/app/sites/${property.id}`;

  // Proof the script runs on the site: the newest consent receipt, or the last day the banner was shown.
  const days = rangeDays(30);
  const [[latest], counters] = await Promise.all([store.listReceipts(property.id, { limit: 1 }), store.listCounters(property.id, days[0], days[days.length - 1])]);
  const views = counters.reduce((n, c) => n + c.views, 0);
  const lastViewDay = counters.filter((c) => c.views > 0).reduce<string | undefined>((d, c) => (!d || c.day > d ? c.day : d), undefined);
  const lastSeen = [latest?.timestamp.slice(0, 10), lastViewDay].filter((d): d is string => !!d).sort().at(-1);
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const methods = installMethods({
    siteKey: property.siteKey,
    src: SDK_URL,
    api,
    configUrl: onCdn ? `${CDN_ORIGIN}/c/${property.siteKey}.json` : undefined,
    gcm: (property.published?.config ?? property.config).googleConsentMode,
  });
  const configUrl = onCdn ? `${CDN_ORIGIN}/c/${property.siteKey}.json` : `${api}/config/${property.siteKey}`;

  const blocking = `<!-- Before: runs immediately -->
<script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>

<!-- After: held until the visitor allows Analytics -->
<script type="text/plain" data-consent="analytics"
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>`;

  const headless = `// Read and change consent from your own UI
const state = window.PlainConsent.get();      // { decided, categories, framework }
window.PlainConsent.set({ analytics: true, marketing: false });
window.PlainConsent.on("change", (s) => console.log(s.categories));
window.PlainConsent.open();                   // reopen preferences
window.PlainConsent.revoke();                 // withdraw consent (DPDPA)`;

  // The status, in one of three states, with the page's only primary action.
  const status = !published ? (
    <Card className="mb-6 max-w-4xl" tone="default">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-amber-bright" />
          <div>
            <p className="text-sm font-semibold text-ink">Publish your banner first</p>
            <p className="mt-0.5 text-sm text-ink-3">The script shows the published banner. Publish once, then add the script to {domain}.</p>
          </div>
        </div>
        {can(role, "property:write") ? <ButtonLink href={`${base}/banner?tab=review`}>Review and publish</ButtonLink> : null}
      </CardBody>
    </Card>
  ) : lastSeen ? (
    <Card className="mb-6 max-w-4xl">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success-wash text-success">
            <IconCheck size={14} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Connected to {domain}</p>
            <p className="mt-0.5 text-sm text-ink-3">
              Last seen {day(lastSeen)}
              {views ? ` · ${formatInt(views)} banner ${views === 1 ? "view" : "views"} in 30 days` : ""} · v{property.publishedVersion} live
              {dirty ? " · newer changes not published" : ""}
            </p>
          </div>
        </div>
        <InstallCheck propertyId={property.id} domain={domain} variant="secondary" />
      </CardBody>
    </Card>
  ) : (
    <Card className="mb-6 max-w-4xl">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden className="relative mt-1.5 grid size-2.5 shrink-0 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-bright/60 motion-reduce:hidden" />
            <span className="size-2.5 rounded-full bg-amber-bright" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Waiting for the script on {domain}</p>
            <p className="mt-0.5 max-w-[52ch] text-sm text-ink-3">Add the snippet below. This turns to Connected by itself the first time the banner loads, or check now.</p>
          </div>
        </div>
        <InstallCheck propertyId={property.id} domain={domain} />
      </CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Install"
        description={
          <>
            Put the script on {property.domain}. It shows your banner and holds trackers until visitors choose. <LearnMore anchor="install" topic="installing" />
          </>
        }
      />

      {status}

      <ol className="max-w-4xl space-y-4">
        <Step n={1} title="Add the script to every page" description={`Choose your platform. The code already carries this site's key, and choices are only accepted from ${domain} and its subdomains.`}>
          <InstallMethods methods={methods} />
        </Step>
        <Step n={2} title="Check it works" description="Open your site in a private window: the banner appears, and your choice shows up in the consent log.">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="btn btn-link text-sm">
              Open {domain}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Link href={`${base}/logs`} className="btn btn-link text-sm">
              Open the consent log
            </Link>
          </div>
        </Step>
      </ol>

      <div className="mt-8 max-w-4xl space-y-3">
        <h2 className="eyebrow px-1">More options</h2>
        <More title="Site key and config URL" description="For a tag manager or a custom loader.">
          <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <CopyField id="site-key" label="Site key" value={property.siteKey} hint="Public and safe to ship in HTML." />
            <CopyField id="config-url" label="Published config URL" value={configUrl} hint={onCdn ? "Served from our CDN, close to each visitor." : "Served by the consent API."} />
          </div>
        </More>
        <More title="Hold scripts you add by hand" description="Trackers in the cookie catalog are held automatically; this is for anything else.">
          <p>
            Change the script&apos;s type and name its category. <LearnMore anchor="blocking" topic="blocking scripts" />
          </p>
          <CodeBlock id="blocking-label" label="HTML" code={blocking} />
        </More>
        <More title="Build your own banner (headless)" description="Drive consent from your own components; Google tags read the same choices.">
          <p>
            Turn on headless mode in Banner studio, then use the JavaScript API. <LearnMore anchor="consent-mode" topic="Google Consent Mode" />
          </p>
          <CodeBlock id="headless-label" label="JavaScript" code={headless} />
        </More>
      </div>
    </>
  );
}
