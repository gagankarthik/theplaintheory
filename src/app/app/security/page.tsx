import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { evaluateControls } from "@/lib/security-controls";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Security" };

/** Organisational controls the product can't measure; they're evidenced by the documents in docs/soc2. */
const ORGANISATIONAL = [
  { criteria: "CC1, CC2", title: "Security policies approved and acknowledged by staff", doc: "information-security-policy.md" },
  { criteria: "CC3", title: "Annual risk assessment", doc: "risk-assessment.md" },
  { criteria: "CC7.3–CC7.5", title: "Incident response, including 72-hour breach notification", doc: "incident-response-plan.md" },
  { criteria: "CC8.1", title: "Reviewed changes, CI checks and dependency scanning", doc: "change-management-policy.md" },
  { criteria: "CC9.2", title: "Annual review of subprocessors (AWS, Stripe)", doc: "vendor-management-policy.md" },
  { criteria: "A1.2, A1.3", title: "Backups and a tested restore", doc: "business-continuity-and-dr.md" },
];

export default async function SecurityPage() {
  const { org, role } = await requireUser();
  if (!can(role, "audit:read")) notFound();
  const controls = await evaluateControls(await getStore(), org);
  const passing = controls.filter((c) => c.status === "pass").length;

  return (
    <>
      <PageHeader
        title="Security"
        description={`Live status of the controls Plain Theory runs for ${org.name}, mapped to SOC 2 Trust Services Criteria. Use it to prepare for an audit, not as a substitute for one.`}
      />

      <p className="mb-6 text-sm text-ink-2" aria-live="polite">
        <strong className="text-ink">
          {passing} of {controls.length}
        </strong>{" "}
        controls passing{controls.length - passing ? `; ${controls.length - passing} need attention.` : "."}
      </p>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {controls.map((c) => (
          <li key={c.id} className="grid gap-3 px-5 py-5 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-start md:gap-6">
            <div className="flex flex-wrap gap-1.5 md:flex-col md:items-start">
              {c.criteria.map((k) => (
                <span key={k} className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                  {k}
                </span>
              ))}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold">{c.title}</h2>
              <p className="mt-1 text-sm text-ink-3">{c.detail}</p>
              {c.evidence.length ? (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {c.evidence.map((e) =>
                    e.href.startsWith("/api/") ? (
                      <a key={e.href} href={e.href} download className="font-bold text-brand-ink underline-offset-4 hover:underline">
                        {e.label}
                      </a>
                    ) : (
                      <Link key={e.href} href={e.href} className="font-bold text-brand-ink underline-offset-4 hover:underline">
                        {e.label}
                      </Link>
                    ),
                  )}
                </p>
              ) : null}
            </div>
            <div className="md:pt-0.5">{c.status === "pass" ? <Badge tone="released">Passing</Badge> : <Badge tone="held">Needs attention</Badge>}</div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="org-controls" className="mt-12">
        <h2 id="org-controls" className="text-lg font-bold">
          Controls outside the product
        </h2>
        <p className="mt-1 max-w-[68ch] text-sm text-ink-3">
          A SOC 2 report also covers how the company runs. These are evidenced by the policies in <code className="font-mono text-ink-2">docs/soc2</code> and the
          records they require, not by this page.
        </p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {ORGANISATIONAL.map((o) => (
            <li key={o.doc} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 text-sm">
              <span>
                <span className="mr-2 font-mono text-[11px] text-ink-3">{o.criteria}</span>
                {o.title}
              </span>
              <code className="font-mono text-xs text-ink-3">{o.doc}</code>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
