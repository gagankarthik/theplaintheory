import type { Metadata } from "next";
import { MfaPrompt } from "@/components/app/account/mfa-prompt";
import { PageHeader } from "@/components/app/shell/page-header";
import { AddSite } from "@/components/app/sites/add-site";
import { SitesTable } from "@/components/app/sites/sites-table";
import { EmptyState } from "@/components/app/ui/empty-state";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { IconSites } from "@/components/icons";
import { daysAgoIso, formatInt, formatPct, outcomeOf } from "@/lib/analytics";
import { can } from "@/lib/auth/rbac";
import { mfaRequirementState, showMfaPrompt } from "@/lib/auth/second-factor";
import { requireUser } from "@/lib/auth/session";
import { planById } from "@/lib/plans";
import { getStore } from "@/lib/store";
import { heldTrackers } from "@/lib/trackers";

export const metadata: Metadata = { title: "Sites" };

const plural = (n: number, word: string) => `${formatInt(n)} ${word}${n === 1 ? "" : "s"}`;

export default async function SitesPage() {
  const { org, role, user } = await requireUser();
  const store = await getStore();
  const properties = await store.listProperties(org.id);
  const since = daysAgoIso(30);
  const leakSince = daysAgoIso(7);
  // One parallel round per site: the table's 30-day decisions plus the 7-day leak count for the strip.
  const sites = await Promise.all(
    properties.map(async (p) => {
      const [receipts, leaks] = await Promise.all([store.listReceipts(p.id, { from: since }), store.listLeaks(p.id, leakSince)]);
      const decisions = receipts.filter((r) => outcomeOf(r.action));
      const accepted = decisions.filter((r) => r.action === "accept_all").length;
      return {
        accepted,
        leaks: leaks.length,
        row: {
          id: p.id,
          name: p.name,
          domain: p.domain,
          dirty: p.config.version !== p.publishedVersion,
          published: p.publishedVersion > 0,
          trackers: heldTrackers(p.trackers).length,
          decisions: decisions.length,
          optIn: decisions.length ? accepted / decisions.length : null,
        },
      };
    }),
  );
  const rows = sites.map((s) => s.row);
  const plan = planById(org.plan);
  const atLimit = plan.properties !== null && properties.length >= plan.properties;
  const addSite = can(role, "property:create") ? <AddSite atLimit={atLimit} planName={plan.name} limit={plan.properties} /> : null;

  // Organization totals, from the same per-site numbers the table shows.
  const live = rows.filter((r) => r.published).length;
  const unpublished = rows.filter((r) => r.published && r.dirty).length;
  const decisions = rows.reduce((a, r) => a + r.decisions, 0);
  const accepted = sites.reduce((a, s) => a + s.accepted, 0);
  const leaks = sites.reduce((a, s) => a + s.leaks, 0);
  const leaking = sites.filter((s) => s.leaks > 0);

  // Two-factor nudge: the deadline for a member who skipped required setup, else an optional prompt.
  const mfaState = mfaRequirementState(org, user);
  const mfaPrompt =
    mfaState === "deferred" ? (
      <MfaPrompt kind="deferred" orgName={org.name} deadline={user.mfaSetupDeferredUntil} />
    ) : mfaState === "ok" && showMfaPrompt(user) ? (
      <MfaPrompt kind="optional" />
    ) : null;

  return (
    <>
      <PageHeader live title="Sites" description={`Every site in ${org.name}. Each has its own banner, trackers and consent log.`} actions={rows.length ? addSite : null} />
      {mfaPrompt}
      {rows.length === 0 ? (
        <EmptyState icon={<IconSites size={24} />} title="Add your first site" action={addSite}>
          You&apos;ll get a script tag to paste into your site. Trackers stay held until visitors choose.
        </EmptyState>
      ) : (
        <>
          <StatStrip
            label="All sites at a glance"
            stats={[
              {
                label: "Sites live",
                value: `${live} of ${rows.length}`,
                note:
                  live < rows.length
                    ? `${plural(rows.length - live, "site")} not published yet`
                    : unpublished
                      ? `${plural(unpublished, "site")} with unpublished changes`
                      : "Every banner is published",
                tone: live < rows.length ? "warn" : undefined,
              },
              {
                label: "Decisions, last 30 days",
                value: formatInt(decisions),
                note: decisions ? `Across ${plural(rows.filter((r) => r.decisions > 0).length, "site")}` : "No visitor has chosen yet",
              },
              {
                label: "Opt-in rate, last 30 days",
                value: decisions ? formatPct(accepted / decisions) : "—",
                note: decisions ? `${formatInt(accepted)} accepted all` : "Shows once visitors choose",
              },
              {
                label: "Leaks, last 7 days",
                value: formatInt(leaks),
                note: leaks ? `On ${plural(leaking.length, "site")}` : "Nothing fired after a refusal",
                tone: leaks > 0 ? "bad" : undefined,
                // one affected site: go straight to its leak report
                href: leaking.length === 1 ? `/app/sites/${leaking[0].row.id}/leaks?range=7` : undefined,
              },
            ]}
          />
          <SitesTable
            rows={rows}
            footer={plan.properties === null ? plural(rows.length, "site") : `${rows.length} of ${plural(plan.properties, "site")} used on the ${plan.name} plan`}
          />
        </>
      )}
    </>
  );
}
