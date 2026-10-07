import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishButton } from "@/components/app/sites/publish-button";
import { PublishBadge } from "@/components/app/ui/badge";
import { CopyButton } from "@/components/app/ui/copy-button";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { site } from "@/lib/site";

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
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed" tabIndex={0} role="region" aria-labelledby={id}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-4 border-t border-line py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
      <div className="flex gap-3">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-xs font-bold tabular-nums text-ink-2">
          {n}
        </span>
        <h2 className="pt-0.5 text-base font-bold">
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
  const { property, role } = await requireProperty(propertyId);
  const origin = site.url.replace(/\/$/, "");
  const cdn = process.env.PUBLISH_DRIVER === "s3" ? process.env.NEXT_PUBLIC_CDN_URL : undefined;
  const dirty = property.config.version !== property.publishedVersion;

  const snippet = [
    `<script`,
    `  src="${cdn ?? origin}/sdk/plain-consent.js"`,
    `  data-site="${property.siteKey}"`,
    `  data-api="${origin}/api/v1"`,
    ...(cdn ? [`  data-config-url="${cdn}/c/${property.siteKey}.json"`] : []),
    `></script>`,
  ].join("\n");

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
        description={`Add one script tag to ${property.domain}. It's under 10 KB and loads before any tracker.`}
        actions={can(role, "property:write") ? <PublishButton propertyId={property.id} dirty={dirty} /> : null}
      />

      <ol className="max-w-5xl">
        <Step n={1} title="Paste the snippet">
          <p>
            Put it as high as possible in <code className="font-mono text-ink">&lt;head&gt;</code>, above Google Tag Manager, analytics and ad scripts, so it can hold them.
          </p>
          <Code id="snippet-label" label="HTML, in <head>" code={snippet} />
          <p>
            Site key <code className="rounded bg-line px-1.5 py-0.5 font-mono text-ink">{property.siteKey}</code> is public and safe to ship in HTML.
          </p>
        </Step>
        <Step n={2} title="Hold scripts you add by hand">
          <p>Scripts listed on the Trackers page are held automatically. For anything else, change its type and say which category it needs.</p>
          <Code id="blocking-label" label="HTML" code={blocking} />
        </Step>
        <Step n={3} title="Publish your banner">
          <p className="flex flex-wrap items-center gap-2">
            Status: <PublishBadge dirty={dirty} published={property.publishedVersion > 0} />
            {property.publishedAt ? <span className="text-ink-3">Last published {new Date(property.publishedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span> : null}
          </p>
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
