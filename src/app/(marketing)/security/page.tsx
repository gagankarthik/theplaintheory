import { pageMetadata } from "@/lib/seo";
import { ARCHIVE_SCENE, IsoScene } from "@/components/illustrations/iso-scene";
import { FinalCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/primitives";
import { ROLES, ROLE_INFO } from "@/lib/auth/rbac";

export const metadata = pageMetadata({
  title: "Security",
  description: "How Plain Theory protects consent data: encryption, data residency, a tamper-evident consent log, two-factor sign-in, audit trails and SOC 2 preparation.",
  path: "/security",
  socialTitle: "How we protect consent data",
});

interface Control {
  term: string;
  detail: string;
}

const GROUPS: { id: string; title: string; summary: string; controls: Control[] }[] = [
  {
    id: "data",
    title: "Data we keep, and how little",
    summary: "A consent record needs to prove a decision, not identify a person. We store the minimum that does that.",
    controls: [
      {
        term: "No raw IP addresses",
        detail:
          "The last octet of an IPv4 address (or the last 80 bits of IPv6) is dropped, then the rest is hashed with a secret salt. The original address is never written anywhere.",
      },
      {
        term: "Random visitor IDs",
        detail: "Each browser gets a random 128-bit identifier. It isn't derived from a device, an account or anything personal.",
      },
      {
        term: "Consent only",
        detail: "Receipts hold the decision, notice version, time, country, device type and browser family. No page content, form data or cookies from your site.",
      },
    ],
  },
  {
    id: "integrity",
    title: "Records you can trust",
    summary: "An audit log is only useful if nobody, including us, can quietly change it.",
    controls: [
      {
        term: "Hash chain",
        detail:
          "Each receipt includes the SHA-256 hash of the previous one. Changing, inserting or removing a record breaks every link after it, and verification shows where.",
      },
      {
        term: "Append-only writes",
        detail: "New receipts are written with a conditional write on the chain head, so two writers can never fork the chain.",
      },
      {
        term: "Independent verification",
        detail: "The export includes every hash, so an auditor can recompute the chain with standard tools and no access to our systems.",
      },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    summary: "Plain Theory runs on AWS, with consent data stored in India.",
    controls: [
      {
        term: "Data residency",
        detail: "Stored in India (Mumbai, ap-south-1). EU or US residency on Enterprise, by arrangement.",
      },
      { term: "Encryption in transit", detail: "TLS 1.2 or newer on every endpoint, with TLS 1.3 negotiated where the client supports it." },
      { term: "Encryption at rest", detail: "AES-256 for the consent database, its backups and configuration storage, with database keys managed in AWS KMS." },
      { term: "Backups", detail: "Point-in-time recovery on the consent database, with 35 days of restore points." },
    ],
  },
  {
    id: "application",
    title: "Application security",
    summary: "The script runs on your visitors' pages, so it's built to be inert to everything else there.",
    controls: [
      {
        term: "Isolated banner",
        detail: "The banner renders in a closed shadow root and every value inserted into it is escaped. Links that aren't http or https are dropped.",
      },
      {
        term: "Origin checks",
        detail: "Consent receipts are only accepted from the domain registered for that site key, and the consent, event and receipt endpoints are rate limited.",
      },
      {
        term: "Safe scanning",
        detail: "The tracker scanner refuses private, loopback and link-local addresses and re-checks every redirect, so it can't be pointed at internal systems.",
      },
      {
        term: "Sign-in and sessions",
        detail:
          "Two-factor sign-in with an authenticator app, which owners can require for everyone. Sessions end after 30 minutes idle or 12 hours, and can be revoked from any device. Passwords need 12+ characters, are hashed with scrypt (or handled by Amazon Cognito), and repeated failures lock the account.",
      },
      { term: "Audit trail", detail: "Sign-ins, access changes, settings, publishing and exports are recorded in a hash-chained log that owners, admins and auditors can verify and export." },
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        tone="ink"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Security", href: "/security" },
        ]}
        title="Security built for the records you'll be asked to show"
        lead="Consent data is evidence. We keep as little of it as possible, keep it where you choose, and make it impossible to alter without anyone noticing."
        figure={
          <div className="mx-auto grid aspect-[4/3] max-w-[420px] place-items-center rounded-[var(--radius-xl)] bg-white">
            <IsoScene items={ARCHIVE_SCENE} label="An archive of stacked drawers, one pulled out" className="h-[62%] w-auto" />
          </div>
        }
      />

      {GROUPS.map((g, i) => (
        <Section key={g.id} id={g.id} tone={i % 2 === 0 ? "white" : "paper"} labelledBy={`${g.id}-h`}>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
              <h2 id={`${g.id}-h`} className="display text-[2rem] sm:text-[2.25rem]">
                {g.title}
              </h2>
              <p className="mt-4 max-w-[38ch] text-ink-2">{g.summary}</p>
            </div>
            <dl className="divide-y divide-line border-y border-line lg:col-span-8">
              {g.controls.map((c) => (
                <div key={c.term} className="grid gap-1.5 py-6 md:grid-cols-[200px_1fr] md:gap-8">
                  <dt className="font-semibold">{c.term}</dt>
                  <dd className="text-[15px] leading-relaxed text-ink-2">{c.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      ))}

      <Section id="access" tone="white" labelledBy="access-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-4">
            <h2 id="access-h" className="display text-[2rem] sm:text-[2.25rem]">
              Who can do what
            </h2>
            <p className="mt-4 max-w-[38ch] text-ink-2">Every organization has five roles, from owner to read-only viewer. Each permission is checked on the server, not just hidden in the interface.</p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2 lg:col-span-8">
            {ROLES.map((r) => (
              <li key={r} className="bg-surface p-6 sm:last:col-span-2">
                <p className="font-semibold capitalize">{r}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{ROLE_INFO[r]}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="compliance" tone="ink" labelledBy="compliance-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
            <h2 id="compliance-h" className="display text-[2rem] sm:text-[2.25rem]">
              Audits and disclosure
            </h2>
          </div>
          <dl className="divide-y divide-white/10 border-y border-white/10 lg:col-span-7">
            <div className="grid gap-1.5 py-6 md:grid-cols-[200px_1fr] md:gap-8">
              <dt className="font-semibold">SOC 2 Type II</dt>
              <dd className="text-[15px] leading-relaxed text-white/70">
                In preparation. Our controls are being mapped to the Trust Services Criteria ahead of an independent audit. We&apos;ll
                publish the report date here, and we don&apos;t claim certification until then.
              </dd>
            </div>
            <div className="grid gap-1.5 py-6 md:grid-cols-[200px_1fr] md:gap-8">
              <dt className="font-semibold">Security questionnaires</dt>
              <dd className="text-[15px] leading-relaxed text-white/70">
                Enterprise customers can request our completed questionnaire and architecture overview under NDA.
              </dd>
            </div>
            <div className="grid gap-1.5 py-6 md:grid-cols-[200px_1fr] md:gap-8">
              <dt className="font-semibold">Report a vulnerability</dt>
              <dd className="text-[15px] leading-relaxed text-white/70">
                Email{" "}
                <a href="mailto:security@theplaintheory.in" className="font-medium text-white underline underline-offset-4">
                  security@theplaintheory.in
                </a>
                . We acknowledge reports within two business days and won&apos;t take legal action against good-faith research.
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      <FinalCta title="Put consent records on solid ground" />
    </>
  );
}
