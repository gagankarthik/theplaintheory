import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/app/logs/print-button";
import { ACTION, CAT_SHORT, relativeTime, utcLong } from "@/components/app/logs/receipt-labels";
import { ReceiptVerify } from "@/components/app/logs/receipt-verify";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { CopyButton } from "@/components/app/ui/copy-button";
import { DescriptionList, type DescriptionItem } from "@/components/app/ui/description-list";
import { IconAlert, IconInfo, IconShieldCheck } from "@/components/icons";
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

/** A full hash in the data font with its copy button; the label names both. */
function Hash({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p id={id} className="text-xs text-ink-3">
        {label}
      </p>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <code className="min-w-0 break-all font-mono text-xs leading-5 text-ink">{value}</code>
        <span className="shrink-0 print:hidden">
          <CopyButton value={value} label="Copy" describedBy={id} />
        </span>
      </div>
    </div>
  );
}

function decisionFacts(r: ConsentReceipt): DescriptionItem[] {
  const fw = FRAMEWORK_META[r.framework];
  return [
    { label: "Outcome", value: <Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Badge> },
    {
      label: "Categories",
      value: (
        <ul className="flex flex-col gap-1.5" aria-label="Categories">
          {(Object.keys(CAT_SHORT) as CategoryId[]).map((c) => (
            <li key={c} className="flex items-center justify-between gap-3 sm:max-w-xs">
              <span>{CAT_SHORT[c]}</span>
              <Badge tone={r.categories[c] ? "released" : "held"}>{r.categories[c] ? "Allowed" : "Held"}</Badge>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: "Recorded",
      value: (
        <>
          <time dateTime={r.timestamp} className="tabular-nums">
            {utcLong(r.timestamp)}
          </time>
          <span className="block text-xs text-ink-3">{relativeTime(r.timestamp)}</span>
        </>
      ),
    },
    { label: "Global Privacy Control", value: r.gpc === undefined ? "Not recorded (sent by an older script)" : r.gpc ? "Signal sent and honoured" : "No signal sent" },
    ...(r.automated ? [{ label: "Browser", value: "Automated browser (navigator.webdriver was on)" }] : []),
    { label: "Notice", value: `${fw.name} · ${fw.law}` },
    { label: "Language", value: r.language ? `${displayName(r.language, "language")} (${r.language})` : "Not recorded" },
    { label: "Country", value: r.country && r.country !== "XX" ? `${displayName(r.country, "region")} (${r.country})` : "Unknown" },
    {
      label: "Device",
      value: (
        <>
          <span className="capitalize">{r.device}</span>
          {r.browser ? `, ${r.browser}` : ""}
        </>
      ),
    },
    {
      label: "Visitor id",
      value: (
        <span className="flex flex-wrap items-center gap-2">
          <code id="r-visitor" className="break-all font-mono text-xs">
            {r.visitorId}
          </code>
          <span className="print:hidden">
            <CopyButton value={r.visitorId} label="Copy" describedBy="r-visitor-l" />
            <span id="r-visitor-l" hidden>
              Visitor id
            </span>
          </span>
        </span>
      ),
    },
  ];
}

/** The notice text as a quiet, read-only copy: never interactive, never styled like the live banner. */
function NoticeCard({ notice, config }: { notice: NoticeShown; config: BannerConfig }) {
  const buttons = [notice.copy.acceptAll, notice.copy.rejectAll, notice.copy.customize].filter(Boolean);
  return (
    <figure className="rounded-md border border-line bg-canvas p-4 sm:p-5" aria-label="Notice text shown to the visitor (read-only copy)">
      <p className="mb-3 text-xs font-medium text-ink-3">Read-only copy</p>
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
            <li key={b} className="rounded-sm border border-line bg-surface px-3 py-1.5 text-sm text-ink">
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
      {config.policyUrl ? <figcaption className="mt-3 text-xs text-ink-3 [overflow-wrap:anywhere]">Policy link: {config.policyUrl}</figcaption> : null}
    </figure>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-ink-2">
      <IconInfo size={16} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
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

  const notes = [
    notice && notice.ruleFramework !== r.framework ? `The ${FRAMEWORK_META[r.framework].name} notice was off in this version, so the visitor was shown the default notice.` : null,
    notice && !r.language ? `The receipt doesn't record a language, so this is the notice's default language (${displayName(notice.language, "language")}).` : null,
    notice?.translationStatus === "draft" ? "Shown in a machine-assisted translation that had not been reviewed when this version was published." : null,
    config?.headless ? "This version ran in headless mode: the site drew its own banner, so this is the configured notice text rather than a capture of the screen." : null,
  ].filter((n): n is string => Boolean(n));

  return (
    <>
      <PageHeader
        crumbs={[{ href: logHref, label: "Consent log" }, { label: `Receipt #${formatInt(r.seq)}` }]}
        title={`Receipt #${formatInt(r.seq)}`}
        description={`Proof of one consent decision on ${property.domain}.`}
        actions={
          <span className="print:hidden">
            <PrintButton variant="secondary" />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card aria-labelledby="r-decision" className="break-inside-avoid">
          <CardHeader titleId="r-decision" title="Decision" />
          <CardBody>
            <DescriptionList layout="stacked" items={decisionFacts(r)} />
          </CardBody>
        </Card>

        <Card aria-labelledby="r-integrity" className="break-inside-avoid">
          <CardHeader
            titleId="r-integrity"
            title="Integrity"
            description={
              <>
                Each receipt stores the hash of the one before it.{" "}
                <Link href="/security" className="font-medium text-ink underline underline-offset-2 hover:no-underline print:no-underline">
                  How the chain works
                </Link>
              </>
            }
          />
          <CardBody className="flex flex-col gap-5">
            <ReceiptVerify propertyId={property.id} seq={r.seq} initial={{ verification, checkedAt }} />
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <Hash id="r-hash" value={r.hash} label="This receipt's hash" />
              <Hash id="r-prev" value={r.prevHash} label="Previous receipt's hash" />
              <div>
                <p className="text-xs text-ink-3">Chain position</p>
                <p className="mt-1 text-sm tabular-nums text-ink">
                  #{formatInt(r.seq)} of {formatInt(head)}
                </p>
                {firstKept > 1 ? <p className="mt-0.5 text-xs text-ink-3">Receipts before #{formatInt(firstKept)} expired under the retention period.</p> : null}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card aria-labelledby="r-notice" className="mt-6 break-inside-avoid">
        <CardHeader titleId="r-notice" title="What the visitor saw" description="The notice text from the published version recorded on this receipt." />
        <CardBody className="flex flex-col gap-5">
          {snapshot.kind === "missing" ? (
            <Alert tone="info" title="Snapshot not kept for this version">
              The receipt records banner version {formatInt(snapshot.version)}, published before Plain Theory kept a copy of every notice. The site has been republished
              since, so its exact text can&apos;t be shown. The decision, its time and its place in the chain are unaffected.
            </Alert>
          ) : (
            <>
              <DescriptionList
                columns={3}
                items={[
                  { label: "Config version", value: <span className="font-mono text-xs">v{formatInt(r.configVersion)}</span> },
                  {
                    label: "Published",
                    value:
                      snapshot.kind === "snapshot" ? (
                        <time dateTime={snapshot.version.publishedAt}>{utcLong(snapshot.version.publishedAt)}</time>
                      ) : snapshot.publishedAt ? (
                        <time dateTime={snapshot.publishedAt}>{utcLong(snapshot.publishedAt)}</time>
                      ) : (
                        "Not recorded"
                      ),
                  },
                  {
                    label: "Snapshot",
                    value:
                      snapshot.kind !== "snapshot" ? (
                        <span className="font-normal text-ink-2">Not kept; showing the live config, which is still this version.</span>
                      ) : configVersionIntact(snapshot.version) ? (
                        <span className="inline-flex items-center gap-1.5 text-success">
                          <IconShieldCheck size={16} aria-hidden />
                          Matches its hash
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-destructive">
                          <IconAlert size={16} aria-hidden />
                          Changed after publishing
                        </span>
                      ),
                  },
                ]}
              />
              {snapshot.kind === "snapshot" ? <Hash id="r-snap" value={snapshot.version.hash} label="Snapshot hash" /> : null}
              {notes.length ? (
                <div className="flex flex-col gap-2">
                  {notes.map((n) => (
                    <Note key={n}>{n}</Note>
                  ))}
                </div>
              ) : null}
              {notice && config ? <NoticeCard notice={notice} config={config} /> : null}
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
