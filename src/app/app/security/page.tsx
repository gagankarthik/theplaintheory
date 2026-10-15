import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { IconAlert, IconCheck, IconChain, IconLock, IconServer, IconShieldCheck, type IconProps } from "@/components/icons";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
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
  const cls = "font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current";
  return (
    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {c.evidence.map((e) =>
        e.href.startsWith("/api/") ? (
          <a key={e.href} href={e.href} download className={cls}>
            {e.label}
          </a>
        ) : (
          <Link key={e.href} href={e.href} className={cls}>
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

  return (
    <>
      <PageHeader title="Security" description={`Live status of ${org.name}'s security controls, mapped to SOC 2 criteria.`} />

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
            note: `Daily; receipts kept ${planById(org.plan).logRetentionDays.toLocaleString("en-GB")} days`,
            tone: retention?.status === "attention" ? "warn" : undefined,
            href: "/app/audit?action=retention",
          },
        ]}
      />

      {/* Every control, by area */}
      <div className="space-y-6">
        {GROUPS.map((g) => {
          // what needs attention leads its group, so problems are seen first
          const items = g.controls
            .map((id) => byId.get(id))
            .filter((c): c is ControlCheck => Boolean(c))
            .sort((x, y) => Number(x.status === "pass") - Number(y.status === "pass"));
          if (!items.length) return null;
          const Icon = g.icon;
          const open = items.filter((c) => c.status !== "pass").length;
          return (
            <Card key={g.id} aria-labelledby={`group-${g.id}`}>
              <CardHeader
                titleId={`group-${g.id}`}
                icon={<Icon size={18} aria-hidden />}
                title={g.title}
                description={g.summary}
                actions={open ? <Badge tone="warning">{open} to review</Badge> : <Badge tone="success">All passing</Badge>}
              />
              <ul className="divide-y divide-line">
                {items.map((c) => (
                  <li key={c.id} id={`control-${c.id}`} className="grid scroll-mt-24 gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
                    <div className="flex min-w-0 gap-3">
                      <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${c.status === "pass" ? "bg-success-wash text-success" : "bg-warning-wash text-warning"}`}>
                        {c.status === "pass" ? <IconCheck size={14} /> : <IconAlert size={14} />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                        <p className="mt-0.5 text-sm text-ink-3">{c.detail}</p>
                        <Evidence c={c} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-9 md:justify-end md:pl-0">
                      <span className="sr-only">SOC 2 criteria:</span>
                      {c.criteria.map((k) => (
                        <span key={k} className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-xs text-ink-2 ring-1 ring-inset ring-line">
                          {k}
                        </span>
                      ))}
                      {c.status === "pass" ? <Badge tone="success">Passing</Badge> : <Badge tone="warning">Needs attention</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* The company side of SOC 2 */}
      <Card aria-labelledby="company-h" className="mt-6">
        <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[62ch]">
            <h2 id="company-h" className="text-base font-semibold">
              How Plain Theory runs as a company
            </h2>
            <p className="mt-1 text-sm text-ink-3">Our own policies, incident response and backups, for the company side of your audit.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href="/security" variant="secondary">
              Security practices
            </ButtonLink>
            <ButtonLink href="/contact?topic=enterprise">Request documents</ButtonLink>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
