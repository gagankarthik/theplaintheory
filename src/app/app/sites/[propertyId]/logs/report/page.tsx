import type { Metadata } from "next";
import { PrintButton } from "@/components/app/logs/print-button";
import { ButtonLink } from "@/components/app/ui/button";
import { IconAlert, IconArrowRight, IconShieldCheck, Logo } from "@/components/icons";
import { formatInt, formatPct, rangeDays, summarize } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { verifyChain } from "@/lib/crypto";
import { FRAMEWORK_META } from "@/lib/defaults";
import { planById } from "@/lib/plans";
import { regionLabel } from "@/lib/regions";

export const metadata: Metadata = { title: "Audit report" };

const LISTED = 500;

const DECISION_LABEL: Record<string, string> = {
  accept_all: "Accepted all",
  custom: "Chose some",
  reject_all: "Rejected all",
  revoke: "Withdrew",
  dismiss: "Dismissed",
};

export default async function AuditReportPage(props: PageProps<"/app/sites/[propertyId]/logs/report">) {
  const { propertyId } = await props.params;
  const { property, store, org, user } = await requireProperty(propertyId, "logs:export");
  const all = (await store.listReceipts(property.id)).sort((a, b) => a.seq - b.seq);
  const chain = verifyChain(all, property.retentionCheckpoint);
  const days = rangeDays(90);
  const recent = all.filter((r) => r.timestamp >= `${days[0]}T00:00:00.000Z`);
  const s = summarize(recent, await store.listCounters(property.id, days[0], days[days.length - 1]), days);
  const generated = new Date();
  const plan = planById(org.plan);
  const fmt = (d: Date | string) => new Date(d).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const listed = [...recent].reverse().slice(0, LISTED);

  const facts: [string, React.ReactNode][] = [
    ["Organization", org.name],
    ["Website", `${property.name} (${property.domain})`],
    ["Site key", <code key="k" className="font-mono">{property.siteKey}</code>],
    ["Records stored in", regionLabel(org.dataRegion)],
    ["Retention", `${formatInt(plan.logRetentionDays)} days`],
    ["Live banner version", property.publishedVersion ? `v${property.publishedVersion}, published ${property.publishedAt ? fmt(property.publishedAt) : ""}` : "Not published"],
    ["Data Protection Officer", org.dpo ? `${org.dpo.name}, ${org.dpo.email}${org.dpo.address ? `, ${org.dpo.address}` : ""}` : "Not set. Add one in Settings."],
    ["Prepared by", `${user.name} (${user.email})`],
    ["Generated", fmt(generated)],
  ];

  return (
    <div className="pb-10 pt-5 sm:pt-7 print:p-0">
      <div className="mx-auto mb-6 flex max-w-[860px] flex-wrap items-center justify-between gap-3 print:hidden">
        <ButtonLink variant="quiet" href={`/app/sites/${property.id}/logs`}>
          <IconArrowRight size={18} aria-hidden className="rotate-180" />
          Consent log
        </ButtonLink>
        <PrintButton variant="primary" />
      </div>

      <article
        aria-labelledby="report-title"
        className="mx-auto max-w-[860px] rounded-lg border border-line bg-surface px-5 py-8 text-ink sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:border-0 print:p-0"
      >
        <header className="flex flex-col-reverse items-start gap-4 border-b border-ink pb-6 sm:flex-row sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-3">Consent audit report</p>
            <h1 id="report-title" className="mt-1 text-xl font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-2xl">
              {property.domain}
            </h1>
            <p className="mt-1 text-sm tabular-nums text-ink-2">
              Last 90 days, {days[0]} to {days[days.length - 1]}
            </p>
          </div>
          <Logo className="shrink-0" />
        </header>

        <section aria-labelledby="r-chain" className="break-inside-avoid border-b border-line py-6">
          <h2 id="r-chain" className="text-base font-semibold">
            Record integrity
          </h2>
          <p className="mt-3 flex items-start gap-2 text-sm">
            <span className={`mt-0.5 shrink-0 ${chain.ok ? "text-success" : "text-destructive"}`}>
              {chain.ok ? <IconShieldCheck size={18} aria-hidden /> : <IconAlert size={18} aria-hidden />}
            </span>
            <span className="text-ink-2">
              <strong className={`font-semibold ${chain.ok ? "text-success" : "text-destructive"}`}>{chain.ok ? "Chain intact." : `Chain broken at receipt #${chain.brokenAt}.`}</strong>{" "}
              {chain.ok
                ? `All ${formatInt(chain.checked)} receipts since the first were re-hashed and each matches the hash stored in the next one. No record was altered or removed.`
                : "A record was changed or removed after it was written."}
            </span>
          </p>
          {chain.ok && chain.head ? (
            <p className="mt-3 text-xs text-ink-3">
              Head hash <code className="break-all font-mono text-ink-2">{chain.head}</code>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="r-facts" className="break-inside-avoid border-b border-line py-6">
          <h2 id="r-facts" className="mb-4 text-base font-semibold">
            Controller details
          </h2>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[12rem_minmax(0,1fr)] print:grid-cols-[12rem_minmax(0,1fr)]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="mb-2 min-w-0 [overflow-wrap:anywhere] sm:mb-0">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="r-sum" className="break-inside-avoid border-b border-line py-6">
          <h2 id="r-sum" className="mb-4 text-base font-semibold">
            Decisions in the period
          </h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Decision totals</caption>
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 font-medium">
                  Outcome
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Receipts
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-medium">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(
                [
                  ["Accepted all categories", s.accepted],
                  ["Chose specific categories", s.partial],
                  ["Rejected all optional categories", s.rejected],
                ] as const
              ).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" className="py-2 text-left font-normal">
                    {k}
                  </th>
                  <td className="py-2 text-right tabular-nums">{formatInt(v)}</td>
                  <td className="py-2 pl-4 text-right tabular-nums">{formatPct(s.decisions ? v / s.decisions : 0)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 text-left font-normal">
                  Withdrew consent
                </th>
                <td className="py-2 text-right tabular-nums">{formatInt(s.revoked)}</td>
                <td className="py-2 pl-4 text-right text-ink-3">–</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-sm text-ink-2">
            {s.byFramework.length ? (
              <>
                By notice:{" "}
                {s.byFramework.map((f, i) => (
                  <span key={f.key}>
                    {i ? ", " : ""}
                    {FRAMEWORK_META[f.key as keyof typeof FRAMEWORK_META]?.name ?? f.key} {formatInt(f.total)}
                  </span>
                ))}
                .
              </>
            ) : (
              "No consent decisions were recorded in this period."
            )}
          </p>
        </section>

        <section aria-labelledby="r-list" className="pt-6">
          <h2 id="r-list" className="text-base font-semibold">
            Receipts
          </h2>
          <p className="mb-4 mt-1 text-sm text-ink-3">
            {recent.length > LISTED ? `The ${LISTED} most recent of ${formatInt(recent.length)}. The CSV export has every receipt.` : `All ${formatInt(recent.length)} receipts in the period.`} IP
            addresses are truncated and salted before hashing; no raw IP is stored.
          </p>
          <div className="scroll-thin overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label="Receipts in the period">
            <table className="w-full min-w-[640px] text-xs print:min-w-0">
              <caption className="sr-only">Receipts in the period</caption>
              <thead className="text-left text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Time (UTC)
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Decision
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Allowed
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Notice
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Hash
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {listed.map((r) => (
                  <tr key={r.id} className="break-inside-avoid">
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{r.seq}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">{r.timestamp.replace("T", " ").slice(0, 19)}</td>
                    <td className="py-1.5 pr-3">{DECISION_LABEL[r.action] ?? r.action}</td>
                    <td className="py-1.5 pr-3">
                      {Object.entries(r.categories)
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                        .join(", ")}
                    </td>
                    <td className="py-1.5 pr-3">{FRAMEWORK_META[r.framework].name}</td>
                    <td className="py-1.5 font-mono text-ink-2">{r.hash.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </div>
  );
}
