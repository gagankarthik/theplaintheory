"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveRegions } from "@/app/app/sites/[propertyId]/actions";
import { Button } from "@/components/app/ui/button";
import { SettingsRow, SettingsSection } from "@/components/app/ui/settings";
import { Switch } from "@/components/app/ui/switch";
import { Segmented } from "@/components/app/ui/tabs";
import { useToast } from "@/components/app/ui/toast";
import { Select } from "@/components/app/ui/select";
import { formatInt, formatPct } from "@/lib/analytics";
import { FRAMEWORK_META } from "@/lib/defaults";
import type { BannerConfig, Framework } from "@/lib/types";

const ORDER: Framework[] = ["gdpr", "dpdpa", "ccpa", "generic"];

const WHO: Record<Framework, string> = {
  gdpr: "Visitors from the 27 EU countries, Iceland, Liechtenstein, Norway, the UK and Switzerland.",
  dpdpa: "Visitors from India.",
  ccpa: "Visitors from California. Other US states fall back to the default notice.",
  generic: "Everyone else, and anyone whose location can't be determined.",
};

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

/** Banner decisions from one region's visitors over the last 30 days, read from consent receipts. */
export interface RegionStats {
  decisions: number;
  accepted: number;
}

function activity(s: RegionStats | undefined) {
  if (!s?.decisions) return "No decisions in the last 30 days.";
  return `${formatInt(s.decisions)} decision${s.decisions === 1 ? "" : "s"} in the last 30 days, ${formatPct(s.accepted / s.decisions)} accepted all.`;
}

export function RegionsEditor({
  propertyId,
  initial,
  stats,
  canWrite,
}: {
  propertyId: string;
  initial: BannerConfig["regions"];
  stats?: Partial<Record<Framework, RegionStats>>;
  canWrite: boolean;
}) {
  const [regions, setRegions] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const dirty = JSON.stringify(regions) !== JSON.stringify(initial);
  const update = (fw: Framework, patch: Partial<BannerConfig["regions"][Framework]>) => setRegions((r) => ({ ...r, [fw]: { ...r[fw], ...patch } }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveRegions(propertyId, regions);
          if (r?.error) toast(r.error, "error");
          else if (r?.ok) toast(r.ok);
        });
      }}
    >
      <fieldset disabled={!canWrite || pending} className="min-w-0 [&_button]:scroll-mb-28 [&_input]:scroll-mb-28 [&_select]:scroll-mb-28">
        <legend className="sr-only">Regional notices</legend>
        {ORDER.map((fw) => {
          const r = regions[fw];
          const meta = FRAMEWORK_META[fw];
          return (
            <SettingsSection
              key={fw}
              title={`${meta.name}: ${meta.region}`}
              description={
                <>
                  {meta.law}
                  <span className="block tabular-nums">{activity(stats?.[fw])}</span>
                </>
              }
            >
              <SettingsRow label="Who sees it" description={WHO[fw]}>
                <Switch
                  label={r.enabled ? "Shown to these visitors" : "Turned off"}
                  description={r.enabled ? undefined : "These visitors get the default notice instead."}
                  checked={r.enabled}
                  onChange={(v) => update(fw, { enabled: v })}
                  disabled={fw === "generic"}
                />
                {fw === "generic" ? <p className="mt-2 text-xs text-ink-3">The default notice is always on so nobody is left without one.</p> : null}
              </SettingsRow>
              <SettingsRow
                label="Consent model"
                description={
                  r.model === "opt-in"
                    ? "Nothing optional runs until the visitor agrees."
                    : "Optional categories run until the visitor opts out. Allowed under CCPA, not under GDPR or DPDPA."
                }
              >
                <Segmented
                  label={`${meta.name} consent model`}
                  value={r.model}
                  onChange={(v) => update(fw, { model: v })}
                  options={[
                    { value: "opt-in", label: "Opt-in" },
                    { value: "opt-out", label: "Opt-out" },
                  ]}
                />
                {r.model === "opt-out" && (fw === "gdpr" || fw === "dpdpa") ? (
                  <p role="alert" className="mt-2 text-xs font-semibold text-rose">
                    {meta.name} requires opt-in consent. Switch back to opt-in before publishing.
                  </p>
                ) : null}
              </SettingsRow>
              <SettingsRow
                label="Default language"
                htmlFor={`lang-${fw}`}
                description={
                  <>
                    The language this notice is written in. Translations live in{" "}
                    <Link href={`/app/sites/${propertyId}/languages`} className="font-medium text-brand underline underline-offset-2">
                      Languages
                    </Link>
                    .
                  </>
                }
              >
                <div className="max-w-xs">
                  <Select id={`lang-${fw}`} value={r.language} onValueChange={(language) => update(fw, { language })} options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))} />
                </div>
              </SettingsRow>
            </SettingsSection>
          );
        })}
      </fieldset>
      {canWrite ? (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <span className="text-xs text-ink-3">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setRegions(initial)}>
            Discard
          </Button>
          <Button type="submit" loading={pending} loadingLabel="Saving" disabled={!dirty}>
            Save regions
          </Button>
        </div>
      ) : null}
    </form>
  );
}
