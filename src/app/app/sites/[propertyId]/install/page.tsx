import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { CopyButton } from "@/components/app/ui/copy-button";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { formatInt, rangeDays } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { bareDomain } from "@/lib/consent";
import { sdkSizeLabel } from "@/lib/sdk-size";
import { site } from "@/lib/site";
import { installMethods } from "@/lib/install-snippets";
import { InstallMethods } from "@/components/app/sites/install-methods";

export const metadata: Metadata = { title: "Install" };

function Code({ id, label, code }: { id: string; label: string; code: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-ink text-paper">
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[.03] py-1.5 pl-4 pr-1.5 text-xs text-white/70">
        <span id={id}>{label}</span>
        <span className="[&_.btn]:border-white/20 [&_.btn]:text-paper [&_.btn:hover]:border-white/50">
          <CopyButton value={code} describedBy={id} />
        </span>
      </figcaption>
      {/* scrolls sideways on narrow screens; focusable so keyboard users can scroll it too */}
      <pre className="scroll-thin overflow-x-auto p-4 font-mono text-xs leading-relaxed" tabIndex={0} role="region" aria-labelledby={id}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-4 border-t border-line py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
      <div className="flex gap-3">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-xs font-semibold tabular-nums text-ink-2">
          {n}
        </span>
        <h2 className="pt-0.5 text-base font-semibold">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
      </div>
      <div className="min-w-0 space-y-4 text-sm text-ink-2">{children}</div>
    </li>
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
  });

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
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Install" }]}
        title="Install"
        description={`Add the Plain Theory script to ${property.domain}. It shows your banner and holds trackers until visitors choose.`}
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
          { label: "Script size", value: sdkSizeLabel(), note: "Gzipped, loaded once per visit" },
        ]}
      />

      <ol className="max-w-5xl">
        <Step n={1} title="Add the script to your site">
          <p>Choose how your site is built. The code already has this site&apos;s key in it.</p>
          <InstallMethods methods={methods} />
          <p>
            Site key <code className="rounded bg-line px-1.5 py-0.5 font-mono text-ink">{property.siteKey}</code> is public and safe to ship in HTML. Choices are only accepted from{" "}
            <span className="font-medium text-ink">{domain}</span> and its subdomains.
          </p>
        </Step>
        <Step n={2} title="Hold scripts you add by hand">
          <p>Scripts listed on the Trackers page are held automatically. For anything else, change its type and say which category it needs.</p>
          <Code id="blocking-label" label="HTML" code={blocking} />
        </Step>
        <Step n={3} title="Publish your banner">
          <p>Publish from the top bar. Visitors only ever see the published version, never drafts.</p>
          <p>
            Published settings are served from{" "}
            <code className="break-all font-mono text-ink">{cdn ? `${cdn}/c/${property.siteKey}.json` : `${origin}/api/v1/config/${property.siteKey}`}</code>
            {cdn ? (
              " via CloudFront."
            ) : (
              <>
                . Set <code className="font-mono text-ink">PUBLISH_DRIVER=s3</code> to serve them from CloudFront.
              </>
            )}
          </p>
        </Step>
        <Step n={4} title="Optional: build your own banner">
          <p>Turn on headless mode in Banner, then drive consent from your own components.</p>
          <Code id="headless-label" label="JavaScript" code={headless} />
        </Step>
      </ol>
    </>
  );
}
