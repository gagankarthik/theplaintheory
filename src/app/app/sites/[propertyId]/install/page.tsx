import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { CodeBlock } from "@/components/app/configure/code-block";
import { CopyField } from "@/components/app/configure/copy-field";
import { LearnMore } from "@/components/app/configure/learn-more";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { formatInt, rangeDays } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { bareDomain } from "@/lib/consent";
import { site } from "@/lib/site";
import { installMethods } from "@/lib/install-snippets";
import { InstallMethods } from "@/components/app/sites/install-methods";

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

export default async function InstallPage(props: PageProps<"/app/sites/[propertyId]/install">) {
  const { propertyId } = await props.params;
  const { property, store } = await requireProperty(propertyId);
  const origin = site.url.replace(/\/$/, "");
  const cdn = process.env.PUBLISH_DRIVER === "s3" ? process.env.NEXT_PUBLIC_CDN_URL : undefined;
  const published = property.publishedVersion > 0;
  const dirty = property.config.version !== property.publishedVersion;
  const domain = bareDomain(property.domain);

  // Proof the script runs on the site: the newest consent receipt, or the last day the banner was shown.
  const days = rangeDays(30);
  const [[latest], counters] = await Promise.all([store.listReceipts(property.id, { limit: 1 }), store.listCounters(property.id, days[0], days[days.length - 1])]);
  const views = counters.reduce((n, c) => n + c.views, 0);
  const lastViewDay = counters.filter((c) => c.views > 0).reduce<string | undefined>((d, c) => (!d || c.day > d ? c.day : d), undefined);
  const lastSeen = [latest?.timestamp.slice(0, 10), lastViewDay].filter((d): d is string => !!d).sort().at(-1);
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const methods = installMethods({
    siteKey: property.siteKey,
    src: `${cdn ? `${cdn}/sdk/v1` : `${origin}/sdk`}/plain-consent.js`, // the Delivery stack serves the SDK under /sdk/v1/
    api: `${origin}/api/v1`,
    configUrl: cdn ? `${cdn}/c/${property.siteKey}.json` : undefined,
    gcm: (property.published?.config ?? property.config).googleConsentMode,
  });

  const configUrl = cdn ? `${cdn}/c/${property.siteKey}.json` : `${origin}/api/v1/config/${property.siteKey}`;

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

  return (
    <>
      <PageHeader
        title="Install"
        description={
          <>
            Add the script to {property.domain} to show your banner and hold trackers until visitors choose. <LearnMore anchor="install" topic="installing" />
          </>
        }
      />

      <StatStrip
        label="Installation at a glance"
        stats={[
          {
            label: "Script last seen",
            value: lastSeen ? day(lastSeen) : "Not yet",
            note: lastSeen ? "Banner shown or a choice recorded" : published ? "Starts when the snippet is on your site" : "Starts when your banner is live",
          },
          {
            href: `/app/sites/${property.id}`,
            label: "Banner views, last 30 days",
            value: views ? formatInt(views) : "—",
            note: views ? "Times the banner was shown" : "No views yet",
          },
          {
            label: "Live version",
            value: published ? `v${property.publishedVersion}` : "None",
            note: !published ? "Publish from the top bar" : dirty ? "Newer changes not published" : property.publishedAt ? `Published ${day(property.publishedAt)}` : "Up to date",
            tone: published && dirty ? "warn" : undefined,
          },
        ]}
      />

      <Card aria-labelledby="keys-h" className="mb-4 max-w-4xl">
        <CardHeader titleId="keys-h" title="Site key and config" description={`Choices are only accepted from ${domain} and its subdomains.`} />
        <CardBody className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <CopyField id="site-key" label="Site key" value={property.siteKey} hint="Public and safe to ship in HTML." />
          <CopyField
            id="config-url"
            label="Published config URL"
            value={configUrl}
            hint={
              cdn ? (
                "Served via CloudFront."
              ) : (
                <>
                  Set <code className="font-mono text-ink">PUBLISH_DRIVER=s3</code> to serve it from CloudFront.
                </>
              )
            }
          />
        </CardBody>
      </Card>

      <ol className="max-w-4xl space-y-4">
        <Step n={1} title="Add the script to your site" description="The code already has this site's key in it.">
          <InstallMethods methods={methods} />
        </Step>
        <Step
          n={2}
          title="Hold scripts you add by hand"
          description={
            <>
              Trackers in the cookie catalog are held automatically. For anything else, change its type and name its category. <LearnMore anchor="blocking" topic="blocking scripts" />
            </>
          }
        >
          <CodeBlock id="blocking-label" label="HTML" code={blocking} />
        </Step>
        <Step n={3} title="Publish your banner" description="Visitors only ever see the published version, never drafts.">
          <p>Once published, the script reads your settings from the config URL above.</p>
          <div>
            <ButtonLink href={`/app/sites/${property.id}/banner?tab=review`} variant="secondary" size="sm">
              Open Banner studio
            </ButtonLink>
          </div>
        </Step>
        <Step
          n={4}
          title="Optional: build your own banner"
          description={
            <>
              Turn on headless mode in Banner studio, then drive consent from your own components. Google tags read the same choices. <LearnMore anchor="consent-mode" topic="Google Consent Mode" />
            </>
          }
        >
          <CodeBlock id="headless-label" label="JavaScript" code={headless} />
        </Step>
      </ol>
    </>
  );
}
