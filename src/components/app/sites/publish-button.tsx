"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getPublishSummary, publishSite, type PublishSummary } from "@/app/app/sites/[propertyId]/actions";
import { IconCheck } from "@/components/icons";
import { Button, buttonClass, type ButtonSize } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
import { Spinner } from "@/components/app/ui/spinner";
import { useToast } from "@/components/app/ui/toast";

/**
 * Publish never acts blind: it first shows what goes live (what changed, who sees which notice,
 * what's held until consent, whether the script is on the site), then publishes on confirm.
 */
export function PublishButton({ propertyId, dirty, size = "md" }: { propertyId: string; dirty: boolean; size?: ButtonSize }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<PublishSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [pending, start] = useTransition();
  const toast = useToast();

  const review = () => {
    setOpen(true);
    setSummary(null);
    setLoadError(null);
    startLoad(async () => {
      const r = await getPublishSummary(propertyId);
      if ("error" in r) setLoadError(r.error);
      else setSummary(r);
    });
  };

  const publish = () =>
    start(async () => {
      const r = await publishSite(propertyId);
      if (r?.error) toast(r.error, "error");
      else if (r?.ok) {
        setOpen(false);
        toast(r.ok);
      }
    });

  const base = `/app/sites/${propertyId}`;
  return (
    <>
      <Button
        variant={dirty ? "primary" : "ghost"}
        size={size}
        disabled={!dirty}
        title={dirty ? "Review what goes live, then publish" : "Everything saved is already live"}
        onClick={review}
      >
        {!dirty ? <IconCheck size={size === "sm" ? 16 : 18} /> : null}
        {dirty ? "Publish" : "Published"}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        width={520}
        title={summary ? `Publish to ${summary.domain}` : "Publish"}
        description="Publishing updates the consent banner your visitors see. Nothing changes on your site until you confirm."
      >
        {loading || (!summary && !loadError) ? (
          <p className="flex items-center gap-2 py-6 text-sm text-ink-3">
            <Spinner /> Checking what would go live…
          </p>
        ) : loadError ? (
          <p className="py-4 text-sm text-rose">{loadError}</p>
        ) : summary ? (
          <div className="space-y-5 text-sm">
            <section aria-labelledby="pub-changes">
              <h3 id="pub-changes" className="font-semibold text-ink">
                {summary.liveVersion ? `What changes from the live version (v${summary.liveVersion})` : "What goes live"}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
                {summary.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="pub-who">
              <h3 id="pub-who" className="font-semibold text-ink">
                Who sees what
              </h3>
              {summary.notices.length ? (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {summary.notices.map((n) => (
                    <li key={n.law} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
                      <span className="text-ink">
                        Visitors in {n.region} <span className="text-ink-3">· {n.law}</span>
                      </span>
                      <span className="text-xs text-ink-3">
                        {n.model === "opt-in" ? "Asked before any tracking" : "Tracking on, with an opt-out link"} · {n.languages.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink-3">No region has a notice switched on, so no visitor would see the banner.</p>
              )}
              <p className="mt-2 text-ink-3">
                {summary.trackersHeld
                  ? `${summary.trackersHeld} approved tracker${summary.trackersHeld > 1 ? "s wait" : " waits"} until the visitor agrees to ${summary.categories.length ? summary.categories.join(", ").toLowerCase() : "its purpose"}.`
                  : "No trackers are approved yet, so the banner asks for consent but holds nothing back. "}
                {summary.trackersHeld ? null : (
                  <Link href={`${base}/trackers`} className="text-brand underline-offset-2 hover:underline" onClick={() => setOpen(false)}>
                    Scan for trackers
                  </Link>
                )}
              </p>
            </section>

            {!summary.scriptSeen ? (
              <p className="rounded-lg bg-amber-wash px-3 py-2.5 text-amber">
                We haven&apos;t seen the Plain Theory script on {summary.domain} yet. Publishing saves this version, but visitors only see it after you{" "}
                <Link href={`${base}/install`} className="font-semibold underline underline-offset-2" onClick={() => setOpen(false)}>
                  add the script to your site
                </Link>
                .
              </p>
            ) : null}

            {summary.blocking.length ? (
              <div className="rounded-lg bg-rose-wash px-3 py-2.5 text-rose">
                <p className="font-semibold">Publishing is blocked by {summary.blocking.length === 1 ? "a failing check" : `${summary.blocking.length} failing checks`}:</p>
                <ul className="mt-1 list-disc pl-5">
                  {summary.blocking.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
              <Link href={`${base}/banner?tab=review`} className={buttonClass("ghost")} onClick={() => setOpen(false)}>
                {summary.blocking.length ? "Fix in the banner builder" : "Preview the banner"}
              </Link>
              {summary.blocking.length ? null : (
                <Button loading={pending} loadingLabel="Publishing" onClick={publish}>
                  Publish version {summary.draftVersion}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
