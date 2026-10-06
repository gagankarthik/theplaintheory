import type { Metadata } from "next";
import { CheckList, ScoreRing } from "@/components/app/compliance/check-list";
import { PageHeader } from "@/components/app/shell/page-header";
import { requireProperty } from "@/lib/auth/access";
import { planById } from "@/lib/plans";
import { DPDP_CONSENT_MANAGER_DATE, DPDP_DEADLINE, dpdpReadiness, readinessFixHref } from "@/lib/readiness";

export const metadata: Metadata = { title: "DPDP readiness" };

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function daysUntil(iso: string) {
  return Math.ceil((new Date(`${iso}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

export default async function DpdpReadinessPage(props: PageProps<"/app/sites/[propertyId]/dpdp">) {
  const { propertyId } = await props.params;
  const { property, org } = await requireProperty(propertyId);
  const plan = planById(org.plan);
  const r = dpdpReadiness(property, org, plan);
  const fails = r.items.filter((i) => i.severity === "fail").length;
  const warns = r.items.filter((i) => i.severity === "warn").length;
  const days = daysUntil(DPDP_DEADLINE);

  return (
    <>
      <PageHeader
        title="DPDP readiness"
        description={`How ${property.domain} measures up to India's Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025, for what a consent notice and its records can show.`}
      />

      <section aria-labelledby="summary-h" className="mb-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
        <div className="flex items-center gap-5 bg-surface p-6">
          <ScoreRing value={r.percent} label="DPDP readiness" size={72} />
          <div>
            <h2 id="summary-h" className="text-base font-semibold">
              {r.percent >= 90 ? "Ready" : r.percent >= 60 ? "Nearly there" : "Work to do"}
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">
              {r.passed} of {r.total} pass{fails ? `, ${fails} failing` : ""}
              {warns ? `, ${warns} to review` : ""}.
            </p>
          </div>
        </div>
        <div className="bg-surface p-6">
          <p className="text-sm text-ink-3">Most obligations apply from</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{fmt(DPDP_DEADLINE)}</p>
          <p className="mt-1 text-sm text-ink-2">{days > 0 ? `${days} days from today.` : "Now in force."}</p>
        </div>
        <div className="bg-surface p-6">
          <p className="text-sm text-ink-3">Consent Manager registration opens</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{fmt(DPDP_CONSENT_MANAGER_DATE)}</p>
          <p className="mt-1 text-sm text-ink-2">
            A proposal to bring every obligation forward to this date had not been notified as of October 2026.
          </p>
        </div>
      </section>

      <section aria-labelledby="checks-h" className="panel px-5 sm:px-6">
        <h2 id="checks-h" className="sr-only">
          Checklist
        </h2>
        <CheckList
          rows={r.items.map((i) => ({
            id: i.id,
            severity: i.severity,
            title: i.title,
            detail: i.detail,
            ref: i.ref,
            fix: i.fix ? { label: i.fix.label, href: readinessFixHref(property.id, i.fix.target) } : undefined,
          }))}
        />
      </section>
      <p className="mt-4 max-w-[80ch] text-xs text-ink-3">
        This checks what Plain Theory can see: your notice, settings, plan and records. It isn&apos;t legal advice, and it doesn&apos;t cover processing outside your website, such as
        data you collect in apps, stores or call centres.
      </p>
    </>
  );
}
