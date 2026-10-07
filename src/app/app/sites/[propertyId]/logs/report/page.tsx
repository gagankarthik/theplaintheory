import type { Metadata } from "next";
import { PrintButton } from "@/components/app/logs/print-button";
import { ButtonLink } from "@/components/app/ui/button";
import { Logo } from "@/components/icons";
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
    <article className="mx-auto max-w-[860px] bg-surface p-6 text-ink print:max-w-none print:p-0 sm:p-10">
      <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
        <ButtonLink variant="ghost" href={`/app/sites/${property.id}/logs`}>
          Back to consent log
        </ButtonLink>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
        <div>
          <h1 className="text-2xl font-semibold">Consent audit report</h1>
          <p className="mt-1 text-base text-ink-2">
            {property.domain}, last 90 days ({days[0]} to {days[days.length - 1]})
          </p>
        </div>
        <Logo />
      </header>

      <section aria-labelledby="r-chain" className="border-b border-line py-6">
        <h2 id="r-chain" className="text-lg font-semibold">
          Record integrity
        </h2>
        <p className={`mt-2 text-base ${chain.ok ? "text-jade" : "text-rose"}`}>
          <strong>{chain.ok ? "Chain intact." : `Chain broken at receipt #${chain.brokenAt}.`}</strong>{" "}
          {chain.ok
            ? `All ${formatInt(chain.checked)} receipts since the first were re-hashed and each matches the hash stored in the next one. No record was altered or removed.`
            : "A record was changed or removed after it was written."}
        </p>
        {chain.ok && chain.head ? <p className="mt-2 break-all font-mono text-xs text-ink-3">Head hash {chain.head}</p> : null}
      </section>

      <section aria-labelledby="r-facts" className="border-b border-line py-6">
        <h2 id="r-facts" className="mb-3 text-lg font-semibold">
          Controller details
        </h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[200px_1fr]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="r-sum" className="border-b border-line py-6">
        <h2 id="r-sum" className="mb-3 text-lg font-semibold">
          Decisions in the period
        </h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Decision totals</caption>
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th scope="col" className="py-1.5 font-semibold">Outcome</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Receipts</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[
              ["Accepted all categories", s.accepted],
              ["Chose specific categories", s.partial],
              ["Rejected all optional categories", s.rejected],
            ].map(([k, v]) => (
              <tr key={k as string}>
                <th scope="row" className="py-1.5 text-left font-normal">{k}</th>
                <td className="py-1.5 text-right tabular-nums">{formatInt(v as number)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatPct(s.decisions ? (v as number) / s.decisions : 0)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal">Withdrew consent</th>
              <td className="py-1.5 text-right tabular-nums">{formatInt(s.revoked)}</td>
              <td className="py-1.5 text-right text-ink-3">–</td>
            </tr>
          </tbody>
        </table>
        {s.byFramework.length ? (
          <p className="mt-3 text-sm text-ink-2">
            By notice:{" "}
            {s.byFramework.map((f, i) => (
              <span key={f.key}>
                {i ? ", " : ""}
                {FRAMEWORK_META[f.key as keyof typeof FRAMEWORK_META]?.name ?? f.key} {formatInt(f.total)}
              </span>
            ))}
            .
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-2">No consent decisions were recorded in this period.</p>
        )}
      </section>

      <section aria-labelledby="r-list" className="py-6">
        <h2 id="r-list" className="text-lg font-semibold">
          Receipts
        </h2>
        <p className="mb-3 text-sm text-ink-3">
          {recent.length > LISTED ? `The ${LISTED} most recent of ${formatInt(recent.length)}. The CSV export has every receipt.` : `All ${formatInt(recent.length)} receipts in the period.`} IP addresses
          are truncated and salted before hashing; no raw IP is stored.
        </p>
        <table className="w-full text-xs">
          <caption className="sr-only">Receipts in the period</caption>
          <thead className="text-left text-ink-3">
            <tr>
              <th scope="col" className="py-1 pr-2 font-semibold">#</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Time (UTC)</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Decision</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Allowed</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Notice</th>
              <th scope="col" className="py-1 font-semibold">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {listed.map((r) => (
              <tr key={r.id} className="break-inside-avoid">
                <td className="py-1 pr-2 tabular-nums">{r.seq}</td>
                <td className="py-1 pr-2 tabular-nums">{r.timestamp.replace("T", " ").slice(0, 19)}</td>
                <td className="py-1 pr-2">{DECISION_LABEL[r.action] ?? r.action}</td>
                <td className="py-1 pr-2">
                  {Object.entries(r.categories)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                    .join(", ")}
                </td>
                <td className="py-1 pr-2">{FRAMEWORK_META[r.framework].name}</td>
                <td className="py-1 font-mono">{r.hash.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}
