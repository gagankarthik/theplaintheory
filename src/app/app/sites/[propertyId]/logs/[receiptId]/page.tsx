import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/app/logs/print-button";
import { ACTION, CAT_SHORT, relativeTime, utcLong } from "@/components/app/logs/receipt-labels";
import { ReceiptVerify } from "@/components/app/logs/receipt-verify";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { CopyButton } from "@/components/app/ui/copy-button";
import { IconInfo } from "@/components/icons";
import { formatInt } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { configVersionIntact, noticeFor, resolveSnapshot, type NoticeShown } from "@/lib/config-versions";
import { FRAMEWORK_META } from "@/lib/defaults";
import { checkReceipt, parseReceiptSeq } from "@/lib/receipt-proof";
import type { BannerConfig, CategoryId, ConsentReceipt } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/app/sites/[propertyId]/logs/[receiptId]">): Promise<Metadata> {
  const { receiptId } = await props.params;
  const seq = parseReceiptSeq(receiptId);
  return { title: seq ? `Consent receipt #${seq}` : "Consent receipt" };
}

const displayName = (code: string, type: "region" | "language") => {
  try {
    return new Intl.DisplayNames(["en"], { type }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** Card with a heading band, in the style of the settings sections. */
function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-6 overflow-hidden rounded-[16px] border border-line bg-surface break-inside-avoid">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-0.5 max-w-[68ch] text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="px-5 py-4 sm:px-6">{children}</div>
    </section>
  );
}

/** Label/value list: two columns from 640px, stacked below. */
function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Hash({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <code className="min-w-0 break-all font-mono text-xs leading-5 text-ink-2">{value}</code>
      <span className="shrink-0 print:hidden">
        <CopyButton value={value} label={`Copy ${label}`} />
      </span>
    </div>
  );
}

function Decision({ r }: { r: ConsentReceipt }) {
  const fw = FRAMEWORK_META[r.framework];
  return (
    <Facts
      items={[
        ["Outcome", <Badge key="o" tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Badge>],
        [
          "Categories",
          <ul key="c" className="flex flex-col gap-1.5" aria-label="Categories">
            {(Object.keys(CAT_SHORT) as CategoryId[]).map((c) => (
              <li key={c} className="flex items-center justify-between gap-3 sm:max-w-xs">
                <span>{CAT_SHORT[c]}</span>
                <Badge tone={r.categories[c] ? "released" : "held"}>{r.categories[c] ? "Allowed" : "Held"}</Badge>
              </li>
            ))}
          </ul>,
        ],
        [
          "Recorded",
          <span key="t">
            <time dateTime={r.timestamp}>{utcLong(r.timestamp)}</time>
            <span className="block text-xs text-ink-3">{relativeTime(r.timestamp)}</span>
          </span>,
        ],
        ["Global Privacy Control", r.gpc === undefined ? "Not recorded (sent by an older script)" : r.gpc ? "Signal sent and honoured" : "No signal sent"],
        ...(r.automated ? ([["Browser", "Automated browser (navigator.webdriver was on)"]] as [string, ReactNode][]) : []),
        ["Notice", `${fw.name} · ${fw.law}`],
        ["Language", r.language ? `${displayName(r.language, "language")} (${r.language})` : "Not recorded"],
        ["Country", r.country && r.country !== "XX" ? `${displayName(r.country, "region")} (${r.country})` : "Unknown"],
        ["Device", <span key="d"><span className="capitalize">{r.device}</span>{r.browser ? `, ${r.browser}` : ""}</span>],
        ["Visitor id", <code key="v" className="font-mono text-xs">{r.visitorId}</code>],
      ]}
    />
  );
}

/** The notice text as a quiet, read-only card: never interactive, never styled like the live banner. */
function NoticeCard({ notice, config }: { notice: NoticeShown; config: BannerConfig }) {
  const buttons = [notice.copy.acceptAll, notice.copy.rejectAll, notice.copy.customize].filter(Boolean);
  return (
    <figure className="rounded-[12px] border border-line bg-paper p-4 sm:p-5" aria-label="Notice text shown to the visitor (read-only copy)">
      <p className="mb-3 text-2xs font-medium uppercase tracking-wide text-ink-3">Read-only copy</p>
      <div lang={notice.language} className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-ink">{notice.copy.title}</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {notice.copy.body}
          {config.policyUrl && notice.copy.policyLabel ? (
            <>
              {" "}
              <span className="underline">{notice.copy.policyLabel}</span>
            </>
          ) : null}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Buttons">
          {buttons.map((b) => (
            <li key={b} className="rounded-[8px] border border-line bg-surface px-3 py-1.5 text-sm text-ink">
              {b}
            </li>
          ))}
        </ul>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs font-medium text-ink-3">
            Preferences panel <span className="font-normal">· “{notice.copy.save}” to confirm</span>
          </p>
          <ul className="flex flex-col gap-2.5">
            {notice.categories.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium text-ink">{c.label}</span>
                {c.required ? <span className="text-xs text-ink-3"> · always on</span> : null}
                <span className="block text-ink-2">{c.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {config.policyUrl ? (
        <figcaption className="mt-3 text-xs text-ink-3 [overflow-wrap:anywhere]">Policy link: {config.policyUrl}</figcaption>
      ) : null}
    </figure>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-start gap-2 text-sm text-ink-2">
      <IconInfo size={16} className="mt-0.5 shrink-0 text-ink-3" />
      <span>{children}</span>
    </p>
  );
}

export default async function ReceiptProofPage(props: PageProps<"/app/sites/[propertyId]/logs/[receiptId]">) {
  const { propertyId, receiptId } = await props.params;
  // Same access as the consent log: any member who can read the site.
  const { property, store } = await requireProperty(propertyId);
  const seq = parseReceiptSeq(receiptId);
  if (!seq) notFound();

  const checkedAt = new Date().toISOString();
  const [found, newest] = await Promise.all([checkReceipt(store, property, seq), store.listReceipts(property.id, { limit: 1 })]);
  if (!found) notFound();
  const { receipt: r, verification } = found;
  const snapshot = resolveSnapshot(property, r.configVersion, await store.getConfigVersion(property.id, r.configVersion));
  const config = snapshot.kind === "snapshot" ? snapshot.version.config : snapshot.kind === "live" ? snapshot.config : null;
  const notice = config ? noticeFor(config, r.framework, r.language) : null;
  const head = newest[0]?.seq ?? r.seq;
  const firstKept = (property.retentionCheckpoint?.seq ?? 0) + 1;
  const logHref = `/app/sites/${property.id}/logs`;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/app", label: "Sites" },
          { href: `/app/sites/${property.id}`, label: property.name },
          { href: logHref, label: "Consent log" },
          { label: `Receipt #${formatInt(r.seq)}` },
        ]}
        title={`Consent receipt #${formatInt(r.seq)}`}
        description={`Proof of one decision on ${property.domain}: what the visitor chose, the notice they saw, and the hash that ties this record into the site's tamper-evident chain.`}
        actions={
          <span className="print:hidden">
            <PrintButton />
          </span>
        }
      />

      <Section id="r-decision" title="Decision">
        <Decision r={r} />
      </Section>

      <Section id="r-integrity" title="Integrity" description="Each receipt stores the hash of the one before it, so changing or removing any record breaks every link after it.">
        <div className="flex flex-col gap-5">
          <Facts
            items={[
              ["This receipt's hash", <Hash key="h" value={r.hash} label="hash" />],
              ["Previous hash", <Hash key="p" value={r.prevHash} label="previous hash" />],
              [
                "Chain position",
                <span key="pos" className="tabular-nums">
                  #{formatInt(r.seq)} of {formatInt(head)}
                  {firstKept > 1 ? <span className="block text-xs text-ink-3">Receipts before #{formatInt(firstKept)} expired under the retention period.</span> : null}
                </span>,
              ],
            ]}
          />
          <div className="border-t border-line pt-4">
            <ReceiptVerify propertyId={property.id} seq={r.seq} initial={{ verification, checkedAt }} />
          </div>
        </div>
      </Section>

      <Section id="r-notice" title="What the visitor saw" description="The notice text from the published version recorded on this receipt.">
        {snapshot.kind === "missing" ? (
          <div className="rounded-[12px] border border-dashed border-line bg-paper px-4 py-6 text-sm">
            <p className="font-semibold text-ink">Snapshot not kept for this version</p>
            <p className="mt-1 max-w-[60ch] text-ink-3">
              The receipt records banner version {formatInt(snapshot.version)}. That version was published before Plain Theory kept a copy of every published notice,
              and the site has been republished since, so its exact text can&apos;t be shown. The decision, its time and its place in the chain above are unaffected.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Facts
                items={[
                  ["Config version", `v${formatInt(r.configVersion)}`],
                  [
                    "Published",
                    snapshot.kind === "snapshot" ? (
                      <time key="pa" dateTime={snapshot.version.publishedAt}>
                        {utcLong(snapshot.version.publishedAt)}
                      </time>
                    ) : snapshot.publishedAt ? (
                      <time key="pa" dateTime={snapshot.publishedAt}>
                        {utcLong(snapshot.publishedAt)}
                      </time>
                    ) : (
                      "Not recorded"
                    ),
                  ],
                  [
                    "Snapshot hash",
                    snapshot.kind === "snapshot" ? (
                      <span key="sh" className="flex flex-col gap-2">
                        <Hash value={snapshot.version.hash} label="snapshot hash" />
                        {configVersionIntact(snapshot.version) ? (
                          <span className="text-xs text-ink-3">Recomputed from the stored snapshot: matches.</span>
                        ) : (
                          <span className="text-xs font-semibold text-rose">Recomputed from the stored snapshot: does not match. The snapshot was changed after publishing.</span>
                        )}
                      </span>
                    ) : (
                      "None. This version was published before snapshots were kept; the text below is the site's live published config, which is still this version."
                    ),
                  ],
                ]}
              />
            </div>
            {notice && notice.ruleFramework !== r.framework ? (
              <Note>The {FRAMEWORK_META[r.framework].name} notice was off in this version, so the visitor was shown the default notice.</Note>
            ) : null}
            {notice && !r.language ? <Note>The receipt doesn&apos;t record a language, so this is the notice&apos;s default language ({displayName(notice.language, "language")}).</Note> : null}
            {notice?.translationStatus === "draft" ? (
              <Note>Shown in a machine-assisted translation that had not been reviewed when this version was published.</Note>
            ) : null}
            {config?.headless ? (
              <Note>This version ran in headless mode: the site drew its own banner, so this is the configured notice text rather than a capture of the screen.</Note>
            ) : null}
            {notice && config ? <NoticeCard notice={notice} config={config} /> : null}
          </>
        )}
      </Section>
    </>
  );
}
