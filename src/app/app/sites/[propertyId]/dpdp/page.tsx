import type { Metadata } from "next";
import Link from "next/link";
import { LiveSiteCheck } from "@/components/app/compliance/live-site-check";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DescriptionList } from "@/components/app/ui/description-list";
import { Progress } from "@/components/app/ui/progress";
import { IconAlert, IconCheck, IconChevronRight, IconClose } from "@/components/icons";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import type { Severity } from "@/lib/fairness";
import { planById } from "@/lib/plans";
import { DPDP_CONSENT_MANAGER_DATE, DPDP_DEADLINE, dpdpReadiness, readinessFixHref, type ReadinessItem } from "@/lib/readiness";

export const metadata: Metadata = { title: "DPDP readiness" };
/** the live site check server action crawls for up to 20 seconds */
export const maxDuration = 60;

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function daysUntil(iso: string) {
  return Math.ceil((new Date(`${iso}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

/** Status is the icon's shape and the screen-reader word; colour only reinforces it. */
const MARK: Record<Severity, { icon: typeof IconCheck; cls: string; sr: string }> = {
  fail: { icon: IconClose, cls: "bg-destructive-wash text-destructive", sr: "Fails" },
  warn: { icon: IconAlert, cls: "bg-warning-wash text-warning", sr: "To review" },
  pass: { icon: IconCheck, cls: "bg-success-wash text-success", sr: "Passes" },
};

function CheckRows({ items, propertyId }: { items: ReadinessItem[]; propertyId: string }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => {
        const m = MARK[i.severity];
        const Icon = m.icon;
        return (
          <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-6">
            <div className="flex min-w-0 flex-1 gap-3">
              <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${m.cls}`}>
                <Icon size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  <span className="sr-only">{m.sr}: </span>
                  {i.title}
                </p>
                <p className="mt-0.5 text-sm text-ink-2">{i.detail}</p>
                <p className="mt-1 text-xs text-ink-3">{i.ref}</p>
              </div>
            </div>
            {i.fix && i.severity !== "pass" ? (
              <ButtonLink href={readinessFixHref(propertyId, i.fix.target)} variant="secondary" size="sm" className="shrink-0 self-start max-sm:ml-9">
                {i.fix.label}
                <span className="sr-only">: {i.title}</span>
              </ButtonLink>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function DpdpReadinessPage(props: PageProps<"/app/sites/[propertyId]/dpdp">) {
  const { propertyId } = await props.params;
  const { property, org, role, store } = await requireProperty(propertyId);
  const plan = planById(org.plan);
  const [liveSite = null] = await store.listSiteAudits(property.id, 1);
  const r = dpdpReadiness(property, org, plan, { liveSite });
  const failing = r.items.filter((i) => i.severity === "fail");
  const review = r.items.filter((i) => i.severity === "warn");
  const passing = r.items.filter((i) => i.severity === "pass");
  const days = daysUntil(DPDP_DEADLINE);
  const verdict = r.percent >= 90 ? { tone: "success" as const, label: "Ready" } : r.percent >= 60 ? { tone: "warning" as const, label: "Nearly there" } : { tone: "danger" as const, label: "Work to do" };

  return (
    <>
      <PageHeader title="DPDP readiness" description={`How ${property.domain} measures up to India's DPDP Act, 2023 and DPDP Rules, 2025.`} />

      <div className="space-y-6">
        <Card aria-labelledby="summary-h">
          <CardBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-10">
            <div>
              <h2 id="summary-h" className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-ink">{r.percent}%</span>
                <span className="sr-only">ready. </span>
                <Badge tone={verdict.tone}>{verdict.label}</Badge>
              </h2>
              <Progress
                className="mt-4"
                label="DPDP readiness"
                value={r.passed}
                max={r.total}
                valueText={`${r.passed} of ${r.total} checks pass`}
                tone={failing.length ? "bad" : review.length ? "warn" : "ok"}
              />
              <p className="mt-2 text-sm text-ink-3">
                {r.passed} of {r.total} pass{failing.length ? ` · ${failing.length} to fix` : ""}
                {review.length ? ` · ${review.length} to review` : ""}
              </p>
            </div>
            <DescriptionList
              columns={2}
              items={[
                {
                  label: "Most obligations apply from",
                  value: (
                    <>
                      <span className="block">{fmt(DPDP_DEADLINE)}</span>
                      <span className="block text-xs font-normal text-ink-3">{days > 0 ? `${days} days from today` : "Now in force"}</span>
                    </>
                  ),
                },
                {
                  label: "Consent Manager registration opens",
                  value: (
                    <>
                      <span className="block">{fmt(DPDP_CONSENT_MANAGER_DATE)}</span>
                      <span className="block text-xs font-normal text-ink-3">A proposal to move every obligation to this date wasn&apos;t notified as of October 2026</span>
                    </>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card aria-labelledby="checks-h">
          <CardHeader
            titleId="checks-h"
            title="Checklist"
            description="What your notice, settings, plan and records show."
            actions={
              <Link href="/compliance/dpdpa" className="btn btn-link text-sm">
                DPDPA guide<span className="sr-only"> (compliance guide)</span>
              </Link>
            }
          />
          {failing.length ? (
            <section aria-labelledby="fail-h">
              <h3 id="fail-h" className="border-b border-line bg-raised px-5 py-2 text-xs font-medium text-ink-2 sm:px-6">
                To fix ({failing.length})
              </h3>
              <CheckRows items={failing} propertyId={property.id} />
            </section>
          ) : null}
          {review.length ? (
            <section aria-labelledby="warn-h" className={failing.length ? "border-t border-line" : ""}>
              <h3 id="warn-h" className="border-b border-line bg-raised px-5 py-2 text-xs font-medium text-ink-2 sm:px-6">
                To review ({review.length})
              </h3>
              <CheckRows items={review} propertyId={property.id} />
            </section>
          ) : null}
          {passing.length ? (
            <details className={`group ${failing.length || review.length ? "border-t border-line" : ""}`} open={!failing.length && !review.length}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-b-lg px-5 text-sm font-medium text-ink-2 hover:text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
                <IconChevronRight size={16} aria-hidden className="text-ink-3 transition-transform duration-150 ease-out group-open:rotate-90" />
                Passing ({passing.length})
              </summary>
              <div className="border-t border-line">
                <CheckRows items={passing} propertyId={property.id} />
              </div>
            </details>
          ) : null}
        </Card>

        <p className="max-w-[80ch] text-xs text-ink-3">
          This checks what Plain Theory can see. It isn&apos;t legal advice and doesn&apos;t cover processing outside your website, such as apps, stores or call centres.
        </p>

        <LiveSiteCheck key={liveSite?.id ?? "none"} propertyId={property.id} domain={property.domain} initial={liveSite} canRun={can(role, "property:write")} />
      </div>
    </>
  );
}
