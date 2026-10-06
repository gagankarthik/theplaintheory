import type { Metadata } from "next";
import { PrintButton } from "@/components/app/logs/print-button";
import { CheckList } from "@/components/app/compliance/check-list";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink } from "@/components/app/ui/button";
import { EmptyState } from "@/components/app/ui/empty-state";
import { IconLock, Logo } from "@/components/icons";
import { DownloadJson } from "@/components/app/evidence/download-json";
import { formatInt } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { buildEvidencePack } from "@/lib/evidence";
import { planById } from "@/lib/plans";

export const metadata: Metadata = { title: "Evidence Pack" };

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not recorded";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="break-inside-avoid-page border-t border-line py-7 first:border-t-0">
      <h2 id={id} className="mb-4 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[220px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function EvidencePage(props: PageProps<"/app/sites/[propertyId]/evidence">) {
  const { propertyId } = await props.params;
  const { property, org, user, store, role } = await requireProperty(propertyId, "property:read");
  const plan = planById(org.plan);

  if (!can(role, "logs:export")) {
    return (
      <>
        <PageHeader title="Evidence Pack" />
        <EmptyState title="Your role can't export evidence">Ask an owner or admin for access.</EmptyState>
      </>
    );
  }
  if (!plan.limits.evidencePack) {
    return (
      <>
        <PageHeader title="Evidence Pack" description="One document an auditor can rely on: verified chain, the exact notice shown, signals honoured and leaks found." />
        <EmptyState
          icon={<IconLock size={28} />}
          title="Available on Growth and above"
          action={
            <ButtonLink href="/app/billing" variant="primary">
              See plans
            </ButtonLink>
          }
        >
          {org.name} is on the {plan.name} plan. The consent log and CSV export stay available on every plan.
        </EmptyState>
      </>
    );
  }

  const { pack, digest } = await buildEvidencePack({ property, org, plan, user, store });
  const failing = pack.fairness.checks.filter((c) => c.severity === "fail").length;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Evidence Pack"
          description="Generated now from your live records. Print it or save it as PDF for an auditor, or download the signed JSON."
          actions={
            <>
              <DownloadJson
                json={JSON.stringify({ digest, algorithm: "sha256(canonical-json(pack))", pack }, null, 2)}
                filename={`evidence-${property.domain}-${pack.generatedAt.slice(0, 10)}.json`}
              />
              <PrintButton />
            </>
          }
        />
      </div>

      <article className="mx-auto max-w-[900px] rounded-lg border border-line bg-surface px-6 py-8 text-ink sm:px-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
          <div>
            <p className="text-sm text-ink-3">Compliance Evidence Pack</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{property.domain}</h1>
            <p className="mt-1 text-sm text-ink-2">Generated {fmt(pack.generatedAt)} by {pack.generatedBy.name}</p>
          </div>
          <Logo />
        </header>

        <Section id="e-summary" title="Summary">
          <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line text-sm sm:grid-cols-4">
            {[
              ["Consent chain", pack.chain.ok ? "Intact" : `Broken at #${pack.chain.brokenAt}`, pack.chain.ok],
              ["Receipts", formatInt(pack.chain.checked), true],
              ["Fairness", failing ? `${failing} failing` : `${pack.fairness.score}% passing`, !failing],
              ["DPDP readiness", `${pack.readiness.percent}%`, pack.readiness.percent >= 90],
            ].map(([k, v, good]) => (
              <li key={k as string} className="bg-surface px-4 py-3">
                <p className="text-xs text-ink-3">{k as string}</p>
                <p className={`mt-0.5 font-semibold ${good ? "text-ink" : "text-rose"}`}>{v as string}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="e-controller" title="Controller">
          <Facts
            rows={[
              ["Organization", pack.organization.name],
              ["Website", `${pack.site.name} (${pack.site.domain})`],
              ["Site key", <code key="k" className="font-mono text-xs">{pack.site.siteKey}</code>],
              ["Records stored in", pack.organization.dataRegion],
              ["Data Protection Officer", pack.organization.dpo ? `${pack.organization.dpo.name}, ${pack.organization.dpo.email}${pack.organization.dpo.address ? `, ${pack.organization.dpo.address}` : ""}` : "Not set"],
              ["Plan and retention", `${pack.plan.name}, ${formatInt(pack.plan.logRetentionDays)} days`],
            ]}
          />
        </Section>

        <Section id="e-chain" title="Record integrity">
          <p className={`text-sm ${pack.chain.ok ? "text-jade" : "text-rose"}`}>
            <strong>{pack.chain.ok ? "Chain intact." : `Chain broken at receipt #${pack.chain.brokenAt}.`}</strong>{" "}
            {pack.chain.ok
              ? `All ${formatInt(pack.chain.checked)} receipts were re-hashed and each matches the hash stored in the next.`
              : "A record was changed or removed after it was written."}
          </p>
          {pack.chain.head ? <p className="mt-2 break-all font-mono text-xs text-ink-3">Head {pack.chain.head}</p> : null}
          <h3 className="mb-2 mt-5 text-sm font-semibold">Daily anchors, last 30 days</h3>
          <p className="mb-3 text-xs text-ink-3">The last receipt of each UTC day. Published daily, so a rewritten log would no longer match.</p>
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Daily chain anchors</caption>
            <thead className="text-ink-3">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-3 font-medium">Day (UTC)</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Receipts</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Last #</th>
                <th scope="col" className="py-1.5 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pack.anchors.map((a) => (
                <tr key={a.day} className="break-inside-avoid">
                  <td className="py-1.5 pr-3 tabular-nums">{a.day}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatInt(a.receipts)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{a.seq}</td>
                  <td className="py-1.5 font-mono text-ink-2">{a.hash.slice(0, 32)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="e-banner" title="Notice shown to visitors">
          <Facts
            rows={[
              ["Live version", pack.banner.version ? `v${pack.banner.version}, published ${fmt(pack.banner.publishedAt)}` : "Not published"],
              ["Layout", `${pack.banner.layout}, ${pack.banner.equalButtons ? "equal-weight accept and reject" : "accept emphasised"}`],
              ["After a refusal", `Not asked again for ${pack.banner.reaskAfterRejectDays} days`],
              ["Google Consent Mode v2", pack.banner.googleConsentMode ? "On" : "Off"],
              ["Leak detection", pack.banner.leakDetection ? "On" : "Off"],
              ["Policy", pack.banner.policyUrl],
              ["Rights page", pack.banner.rights?.rightsUrl ?? "Uses policy link"],
              ["Grievance contact", pack.banner.rights?.grievanceEmail ?? pack.organization.dpo?.email ?? "Not set"],
            ]}
          />
          <div className="mt-6 space-y-4">
            {pack.banner.regions.map((r) => (
              <div key={r.framework} className="break-inside-avoid rounded-md border border-line p-4">
                <p className="text-xs text-ink-3">
                  {r.name} notice, {r.model}
                </p>
                <p className="mt-1 font-semibold">{r.title}</p>
                <p className="mt-1 text-sm text-ink-2">{r.body}</p>
                <p className="mt-2 text-xs text-ink-3">
                  Buttons: {r.buttons.accept} / {r.buttons.reject} / {r.buttons.customise}
                </p>
                {r.languages.length ? (
                  <p className="mt-2 text-xs text-ink-3">
                    Languages:{" "}
                    {r.languages
                      .map((l) => `${l.name} (${l.status === "reviewed" ? `reviewed${l.reviewedBy ? ` by ${l.reviewedBy.replace(/ \(recorded by .*\)$/, "")}` : ""}` : "draft"})`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>

        <Section id="e-purposes" title="Purposes and data">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Purposes, personal data items and retention</caption>
            <thead className="text-xs text-ink-3">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-3 font-medium">Purpose</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Personal data</th>
                <th scope="col" className="py-1.5 font-medium">Kept for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pack.banner.purposes.map((p) => (
                <tr key={p.id} className="break-inside-avoid align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {p.label}
                    {p.required ? <span className="block text-xs font-normal text-ink-3">Always on</span> : null}
                  </th>
                  <td className="py-2 pr-3 text-ink-2">{p.dataItems.length ? p.dataItems.join(", ") : <span className="text-rose">Not itemised</span>}</td>
                  <td className="py-2 text-ink-2">{p.retention ?? "Not stated"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Trackers held until consent</h3>
          <p className="text-sm text-ink-2">
            {pack.trackers.length ? pack.trackers.map((t) => `${t.name} (${t.category})`).join(", ") : "None listed."}
          </p>
        </Section>

        <Section id="e-signals" title="Signals honoured">
          <Facts
            rows={[
              ["Receipts recorded", formatInt(pack.signals.receipts)],
              ["Global Privacy Control honoured", formatInt(pack.signals.gpcHonoured)],
              ["From automated browsers", formatInt(pack.signals.automated)],
              [
                "By notice",
                Object.entries(pack.signals.byFramework)
                  .map(([f, n]) => `${FRAMEWORK_META[f as keyof typeof FRAMEWORK_META]?.name ?? f} ${formatInt(n)}`)
                  .join(", ") || "None",
              ],
              [
                "By language",
                Object.entries(pack.signals.byLanguage)
                  .map(([l, n]) => `${l} ${formatInt(n)}`)
                  .join(", ") || "Not recorded",
              ],
            ]}
          />
        </Section>

        <Section id="e-leaks" title="Leaks in the last 30 days">
          {pack.leaks.requests === 0 ? (
            <p className="text-sm text-jade">No tracker fired after a refusal.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-2">
                {formatInt(pack.leaks.requests)} request{pack.leaks.requests === 1 ? "" : "s"} fired after visitors declined their category.
              </p>
              <ul className="space-y-1 text-xs">
                {pack.leaks.groups.map((g) => (
                  <li key={`${g.url}${g.page}${g.category}`} className="break-inside-avoid">
                    <span className="font-mono">{g.url}</span> on {g.page}, {g.category} declined, {formatInt(g.count)}×
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section id="e-fairness" title={`Fairness check (${pack.fairness.score}%)`}>
          <CheckList
            dense
            rows={pack.fairness.checks.map((c) => ({ ...c, tag: c.framework === "all" ? undefined : FRAMEWORK_META[c.framework].name }))}
          />
        </Section>

        <Section id="e-readiness" title={`DPDP readiness (${pack.readiness.percent}%)`}>
          <CheckList dense rows={pack.readiness.items} />
        </Section>

        <footer className="mt-4 border-t-2 border-ink pt-5 text-xs text-ink-3">
          <p>
            SHA-256 of this pack (canonical JSON, keys sorted): <span className="break-all font-mono text-ink">{digest}</span>
          </p>
          <p className="mt-1">Recompute it from this pack&apos;s JSON download to confirm nothing was changed after it was generated.</p>
        </footer>
      </article>
    </>
  );
}
