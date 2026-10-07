import type { Metadata } from "next";
import { LanguagesManager } from "@/components/app/languages/languages-manager";
import { PageHeader } from "@/components/app/shell/page-header";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { FREE_LANGUAGES, LANGUAGES, languageInfo } from "@/lib/i18n/languages";
import { planById } from "@/lib/plans";
import type { Framework } from "@/lib/types";
import { upgradeOffer } from "@/lib/upgrade-offer";

export const metadata: Metadata = { title: "Languages" };

const FRAMEWORKS: Framework[] = ["dpdpa", "gdpr", "ccpa", "generic"];

export default async function LanguagesPage(props: PageProps<"/app/sites/[propertyId]/languages">) {
  const { propertyId } = await props.params;
  const { property, org, role } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  const plan = planById(org.plan);

  // Only notices that are switched on reach visitors, so only they count.
  const regions = FRAMEWORKS.map((fw) => property.config.regions[fw]).filter((r) => r.enabled);
  const translations = regions.flatMap((r) => Object.values(r.translations ?? {}).filter((t) => t !== undefined));
  const inUse = new Set(regions.flatMap((r) => [r.language, ...Object.keys(r.translations ?? {})]));
  const allowed = plan.limits.indianLanguages ? LANGUAGES.length : LANGUAGES.filter((l) => !l.eighthSchedule || FREE_LANGUAGES.includes(l.code)).length;
  const reviewed = translations.filter((t) => t.status === "reviewed").length;
  const drafts = translations.length - reviewed;
  // a notice is covered when it offers every language used anywhere on the site, each one reviewed
  const covered = regions.filter((r) =>
    [...inUse].every((code) => code === r.language || r.translations?.[code as keyof typeof r.translations]?.status === "reviewed"),
  );
  const uncovered = regions.filter((r) => !covered.includes(r));
  const defaults = [...new Set(regions.map((r) => r.language))];
  const nameOf = (code: string) => languageInfo(code)?.name ?? code;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Languages" }]}
        title="Languages"
        description="Show each notice in the languages your visitors read. DPDPA allows English or any of the 22 Eighth Schedule languages."
      />
      <StatStrip
        label="Languages at a glance"
        stats={[
          {
            label: "Languages in use",
            value: String(inUse.size),
            note: `of ${allowed} on the ${plan.name} plan`,
          },
          {
            label: "Translations reviewed",
            value: translations.length ? `${reviewed} of ${translations.length}` : "—",
            note: translations.length ? (drafts ? `${drafts} draft${drafts === 1 ? "" : "s"} need a native speaker` : "All checked by a person") : "No translations yet",
            tone: drafts ? "warn" : undefined,
          },
          {
            label: "Notices fully translated",
            value: `${covered.length} of ${regions.length}`,
            note:
              inUse.size === 1
                ? `${nameOf([...inUse][0])} only`
                : uncovered.length
                  ? `${uncovered.map((r) => FRAMEWORK_META[r.framework].name).join(", ")} missing a language`
                  : "Every language, reviewed",
            tone: uncovered.length ? "warn" : undefined,
          },
          {
            label: "Default language",
            value: defaults.length === 1 ? nameOf(defaults[0]) : "Mixed",
            note: defaults.length === 1 ? "Shown when nothing else matches" : defaults.map(nameOf).join(", "),
          },
        ]}
      />
      <LanguagesManager
        key={property.config.version}
        property={property}
        dpo={org.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined}
        canWrite={canWrite}
        indianLanguages={plan.limits.indianLanguages}
        upgrade={plan.limits.indianLanguages ? undefined : await upgradeOffer(org, role, (p) => p.limits.indianLanguages)}
        planName={plan.name}
      />
    </>
  );
}
