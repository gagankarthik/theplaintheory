import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { IconAlert, IconCheck, IconChain, IconLock, IconServer, IconShieldCheck, type IconProps } from "@/components/icons";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { ABSOLUTE_SECONDS, IDLE_SECONDS } from "@/lib/auth/token";
import { planById } from "@/lib/plans";
import { evaluateControls, type ControlCheck } from "@/lib/security-controls";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Security" };

/** Controls by area. Platform controls are run by Plain Theory, not by the customer. */
const GROUPS: { id: string; title: string; summary: string; icon: (p: IconProps) => React.ReactNode; controls: string[] }[] = [
  { id: "access", title: "Access control", summary: "Who can get in, and how.", icon: IconLock, controls: ["mfa-policy", "mfa-coverage", "sessions", "credentials", "access-review", "least-privilege"] },
  { id: "integrity", title: "Monitoring and integrity", summary: "Tamper-evident records of what happened.", icon: IconChain, controls: ["audit-trail", "consent-integrity"] },
  { id: "data", title: "Data lifecycle", summary: "How long records are kept, and when they go.", icon: IconShieldCheck, controls: ["retention"] },
  { id: "platform", title: "Managed by Plain Theory", summary: "Run by us for every customer; nothing to do on your side.", icon: IconServer, controls: ["transport", "secrets"] },
];

function Evidence({ c }: { c: ControlCheck }) {
  if (!c.evidence.length) return null;
  return (
    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {c.evidence.map((e) =>
        e.href.startsWith("/api/") ? (
          <a key={e.href} href={e.href} download className="font-medium text-brand underline-offset-4 hover:underline">
            {e.label}
          </a>
        ) : (
          <Link key={e.href} href={e.href} className="font-medium text-brand underline-offset-4 hover:underline">
            {e.label}
          </Link>
        ),
      )}
    </span>
  );
}

export default async function SecurityPage() {
  const { org, role } = await requireUser();
  if (!can(role, "audit:read")) notFound();
  const store = await getStore();
  const [controls, members] = await Promise.all([evaluateControls(store, org), store.listMembers(org.id)]);
  const byId = new Map(controls.map((c) => [c.id, c]));
  // The score covers the controls the customer runs; platform controls are Plain Theory's and shown separately.
  const own = controls.filter((c) => !GROUPS[3].controls.includes(c.id));
  const passing = own.filter((c) => c.status === "pass").length;
  const attention = own.filter((c) => c.status === "attention");
  const people = members.filter((m) => m.user);
  const withMfa = people.filter((m) => m.user?.mfa).length;
  const retention = byId.get("retention");
  const lastRun = org.retentionLastRunAt ? Date.parse(org.retentionLastRunAt) : null;
  const runAgeH = lastRun === null ? null : Math.max(0, Math.floor((new Date().getTime() - lastRun) / 3_600_000));
  const hours = (sec: number) => `${sec / 3600} hour${sec === 3600 ? "" : "s"}`;

  return (
    <>
      <PageHeader
        title="Security"
        description={`Live status of ${org.name}'s security controls, mapped to SOC 2 criteria to help you prepare for an audit.`}
      />

      <StatStrip
        label="Security posture at a glance"
        stats={[
          {
            label: "Controls passing",
            value: `${passing} of ${own.length}`,
            note: attention.length ? `${attention.length} need${attention.length === 1 ? "s" : ""} attention` : "Checked live on every visit",
            tone: attention.length ? "warn" : undefined,
            href: attention.length ? `#control-${attention[0].id}` : undefined,
          },
          {
            label: "Two-factor coverage",
            value: people.length ? `${Math.round((withMfa / people.length) * 100)}%` : "No members",
            note: `${withMfa} of ${people.length} member${people.length === 1 ? "" : "s"}, ${org.security?.requireMfa ? "required" : "optional"}`,
            tone: withMfa < people.length ? "warn" : undefined,
            href: "/app/team",
          },
          {
            label: "Last retention run",
            value: runAgeH === null ? "Not yet" : runAgeH < 1 ? "Just now" : runAgeH < 48 ? `${runAgeH} h ago` : `${Math.floor(runAgeH / 24)} days ago`,
            note: `Runs daily; receipts kept ${planById(org.plan).logRetentionDays.toLocaleString("en-GB")} days`,
            tone: retention?.status === "attention" ? "warn" : undefined,
            href: "/app/audit?action=retention",
          },
          {
            label: "Session policy",
            value: `${IDLE_SECONDS / 60} min idle`,
            note: `Signed out after ${hours(ABSOLUTE_SECONDS)} at most`,
            href: "/app/account",
          },
        ]}
      />

      {/* Every control, by area */}
      <div className="space-y-8">
        {GROUPS.map((g) => {
          // what needs attention leads its group, so problems are seen first
          const items = g.controls
            .map((id) => byId.get(id))
            .filter((c): c is ControlCheck => Boolean(c))
            .sort((x, y) => Number(x.status === "pass") - Number(y.status === "pass"));
          if (!items.length) return null;
          const Icon = g.icon;
          return (
            <section key={g.id} aria-labelledby={`group-${g.id}`}>
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-[10px] bg-paper text-ink-2 ring-1 ring-inset ring-line">
                  <Icon size={18} />
                </span>
                <div>
                  <h2 id={`group-${g.id}`} className="text-base font-semibold">
                    {g.title}
                  </h2>
                  <p className="text-xs text-ink-3">{g.summary}</p>
                </div>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
                {items.map((c) => (
                  <li key={c.id} id={`control-${c.id}`} className="grid scroll-mt-24 gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
                    <div className="flex min-w-0 gap-3">
                      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${c.status === "pass" ? "bg-jade-wash text-jade" : "bg-amber-wash text-amber"}`}>
                        {c.status === "pass" ? <IconCheck size={14} /> : <IconAlert size={14} />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-medium">{c.title}</h3>
                        <p className="mt-0.5 text-sm text-ink-3">{c.detail}</p>
                        <Evidence c={c} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-9 md:justify-end md:pl-0">
                      {c.criteria.map((k) => (
                        <span key={k} className="rounded bg-paper px-1.5 py-0.5 font-mono text-2xs text-ink-2 ring-1 ring-inset ring-line">
                          {k}
                        </span>
                      ))}
                      {c.status === "pass" ? <Badge tone="released">Passing</Badge> : <Badge tone="held">Needs attention</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* The company side of SOC 2 */}
      <section aria-labelledby="company-h" className="mt-10 flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[62ch]">
          <h2 id="company-h" className="text-base font-semibold">
            How Plain Theory runs as a company
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            An audit also covers our own policies: risk assessment, incident response with 72-hour breach notification, change management, vendor reviews, and tested backups.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/security" className="btn btn-ghost">
            Our security practices
          </Link>
          <Link href="/contact/enterprise" className="btn btn-primary">
            Request compliance documents
          </Link>
        </div>
      </section>
    </>
  );
}
