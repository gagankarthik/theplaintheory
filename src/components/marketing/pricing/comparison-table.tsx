import { Fragment } from "react";
import { PLANS, type Plan } from "@/lib/plans";
import { compactNumber, retentionLabel } from "./billing";
import { CompareByPlan, CompareCell, type CompareGroup, type CompareValue } from "./compare-cells";

type Value = CompareValue;

interface Row {
  feature: string;
  /** one value per plan, in PLANS order: free, starter, growth, business, enterprise */
  value: (plan: Plan) => Value;
}

const unlimited = (n: number | null, none = "Unlimited") => (n === null ? none : n.toLocaleString("en-US"));
const from = (min: Plan["id"]) => {
  const order = PLANS.map((p) => p.id);
  return (plan: Plan) => order.indexOf(plan.id) >= order.indexOf(min);
};

/**
 * Usage rows and plan-gated features come straight from PLANS (limits + quotas), so the table can't
 * drift from what the product enforces. Rows that are true on every plan are listed once.
 */
const GROUPS: { name: string; rows: Row[] }[] = [
  {
    name: "Usage",
    rows: [
      { feature: "Websites", value: (p) => unlimited(p.properties) },
      { feature: "Pageviews a month, pooled", value: (p) => (p.pageviews === null ? "Custom" : compactNumber(p.pageviews)) },
      { feature: "Team seats", value: (p) => unlimited(p.seats) },
      { feature: "Consent log retention", value: (p) => retentionLabel(p.logRetentionDays) },
    ],
  },
  {
    name: "Consent",
    rows: [
      { feature: "GDPR, CCPA/CPRA and DPDPA notices", value: () => true },
      { feature: "Tracker blocking before consent", value: () => true },
      { feature: "Google Consent Mode v2", value: () => true },
      { feature: "Global Privacy Control honoured and logged", value: () => true },
      { feature: "English and Hindi notices", value: () => true },
      { feature: "All 22 Indian languages, with review status", value: (p) => p.limits.indianLanguages },
      { feature: "Itemised data per purpose (DPDP Rule 3)", value: () => true },
      { feature: "Fairness check before publishing", value: () => true },
      { feature: "Headless mode and consent API", value: (p) => (p.limits.apiAccess ? true : "Script API only") },
    ],
  },
  {
    name: "Proof",
    rows: [
      { feature: "Tamper-evident consent log", value: () => true },
      { feature: "Leak alerts after a decline", value: (p) => p.limits.leakDetection },
      { feature: "CSV export", value: from("starter") },
      { feature: "Evidence Pack and chain verification report", value: (p) => p.limits.evidencePack },
      { feature: "Consent analytics by country and device", value: from("growth") },
      { feature: "Signed withdrawal webhooks", value: (p) => p.limits.webhooks },
    ],
  },
  {
    name: "Data and security",
    rows: [
      { feature: "Choice of data region (India, EU, US)", value: (p) => p.limits.residencyChoice },
      { feature: "Owner, admin and viewer roles", value: from("starter") },
      { feature: "Single sign-on", value: from("enterprise") },
      {
        feature: "Delivery SLA",
        value: (p) => (p.id === "enterprise" ? "99.99%" : p.id === "business" ? "99.9%" : false),
      },
      {
        feature: "Support",
        value: (p) =>
          p.id === "enterprise" ? "Named contact" : p.id === "business" ? "Priority email" : p.id === "free" ? "Docs and email" : "Email",
      },
    ],
  },
];

/** Evaluated once on the server into plain data, so the small-screen view (a client component) can use it. */
const MATRIX: CompareGroup[] = GROUPS.map((g) => ({
  name: g.name,
  rows: g.rows.map((r) => ({ feature: r.feature, values: PLANS.map((p) => r.value(p)) })),
}));

/** The recommended plan gets one continuous band from header to last row. */
const FEATURED: Plan["id"] = "growth";
const BAND = "bg-brand-wash/50";

/** Desktop: one table with a sticky plan header. Mobile: a list per plan, so nothing scrolls sideways. */
export function ComparisonTable() {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Features included in each plan</caption>
          <thead className="sticky top-16 z-10 bg-surface/95 backdrop-blur">
            <tr className="border-b border-line-strong">
              <th scope="col" className="w-[30%] py-5 pr-6 align-bottom text-sm font-medium text-ink-3">
                Feature
              </th>
              {PLANS.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={`w-[14%] px-4 pb-5 pt-6 text-center align-bottom text-base font-semibold ${p.id === FEATURED ? `${BAND} rounded-t-[14px] text-brand` : ""}`}
                >
                  {p.id === FEATURED ? <span className="mb-1 block text-xs font-medium text-brand/80">Most teams</span> : null}
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((g, gi) => (
              <Fragment key={g.name}>
                <tr>
                  <th scope="colgroup" className={`pb-3 pr-6 text-sm font-semibold text-ink ${gi === 0 ? "pt-6" : "pt-10"}`}>
                    {g.name}
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.id} aria-hidden className={p.id === FEATURED ? BAND : undefined} />
                  ))}
                </tr>
                {g.rows.map((r, ri) => {
                  const lastRow = gi === MATRIX.length - 1 && ri === g.rows.length - 1;
                  return (
                    <tr key={r.feature} className="group border-t border-line">
                      <th scope="row" className="py-3.5 pr-6 text-sm font-normal text-ink-2 transition-colors group-hover:text-ink">
                        {r.feature}
                      </th>
                      {PLANS.map((p, i) => (
                        <td
                          key={p.id}
                          className={`px-4 py-3.5 text-center ${p.id === FEATURED ? `${BAND} ${lastRow ? "rounded-b-[14px]" : ""}` : ""}`}
                        >
                          <span className="inline-flex justify-center">
                            <CompareCell value={r.values[i]} />
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden">
        <CompareByPlan plans={PLANS.map((p) => ({ id: p.id, name: p.name }))} groups={MATRIX} />
      </div>
    </>
  );
}
