"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveRegions } from "@/app/app/sites/[propertyId]/actions";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { SelectField } from "@/components/app/ui/field";
import { Switch } from "@/components/app/ui/switch";
import { Segmented } from "@/components/app/ui/tabs";
import { useToast } from "@/components/app/ui/toast";
import { formatInt, formatPct } from "@/lib/analytics";
import { FRAMEWORK_META } from "@/lib/defaults";
import type { BannerConfig, Framework } from "@/lib/types";

const ORDER: Framework[] = ["gdpr", "dpdpa", "ccpa", "generic"];

const WHO: Record<Framework, string> = {
  gdpr: "Visitors from the 27 EU countries, Iceland, Liechtenstein, Norway, the UK and Switzerland.",
  dpdpa: "Visitors from India.",
  ccpa: "Visitors from California. Other US states fall back to the default notice.",
  generic: "Everyone else, and anyone whose location can't be determined. Always on, so nobody is left without a notice.",
};

const LANGUAGES: { value: string; label: string }[] = [
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
      aria-label="Regional notices"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveRegions(propertyId, regions);
          if (r?.error) toast(r.error, "error");
          else if (r?.ok) toast(r.ok);
        });
      }}
    >
      <fieldset disabled={!canWrite || pending} className="min-w-0 [&_button]:scroll-mb-28 [&_input]:scroll-mb-28">
        <legend className="sr-only">Regional notices</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          {ORDER.map((fw) => {
            const r = regions[fw];
            const meta = FRAMEWORK_META[fw];
            const unlawful = r.model === "opt-out" && (fw === "gdpr" || fw === "dpdpa");
            const titleId = `region-${fw}-h`;
            return (
              <Card key={fw} aria-labelledby={titleId} className={r.enabled ? "" : "bg-raised"}>
                <CardHeader
                  titleId={titleId}
                  title={
                    <>
                      {meta.name}
                      <span className="font-normal text-ink-3"> · {meta.region}</span>
                    </>
                  }
                  description={<span className="tabular-nums">{activity(stats?.[fw])}</span>}
                  actions={
                    fw === "generic" ? (
                      <Badge tone="neutral">Always on</Badge>
                    ) : (
                      <Switch label={`Show the ${meta.name} notice`} checked={r.enabled} onChange={(v) => update(fw, { enabled: v })} />
                    )
                  }
                />
                <CardBody className="space-y-5">
                  <p className="text-sm text-ink-2">
                    {WHO[fw]}
                    {!r.enabled ? " They get the default notice while this one is off." : ""}
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <p id={`model-${fw}`} className="label">
                        Consent model
                      </p>
                      <Segmented
                        label={`${meta.name} consent model`}
                        value={r.model}
                        onChange={(v) => update(fw, { model: v })}
                        options={[
                          { value: "opt-in", label: "Opt-in" },
                          { value: "opt-out", label: "Opt-out" },
                        ]}
                      />
                      <p className="mt-1.5 text-xs text-ink-3">{r.model === "opt-in" ? "Nothing optional runs until the visitor agrees." : "Optional categories run until the visitor opts out."}</p>
                    </div>
                    <SelectField
                      id={`lang-${fw}`}
                      label="Default language"
                      value={r.language}
                      onValueChange={(language) => update(fw, { language })}
                      options={LANGUAGES}
                      hint={
                        <>
                          Translations live in{" "}
                          <Link href={`/app/sites/${propertyId}/languages`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                            Languages
                          </Link>
                          .
                        </>
                      }
                    />
                  </div>
                  {unlawful ? (
                    <div role="alert">
                      <Alert tone="danger" title={`${meta.name} requires opt-in consent`}>
                        Switch back to opt-in before you publish.
                      </Alert>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </fieldset>
      {canWrite ? (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <span className="mr-auto text-xs text-ink-3 sm:mr-0" aria-live="polite">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button variant="secondary" disabled={!dirty || pending} onClick={() => setRegions(initial)}>
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
