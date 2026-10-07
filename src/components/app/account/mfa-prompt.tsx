"use client";

import { useState, useTransition } from "react";
import { dismissMfaPrompt } from "@/app/app/account/actions";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { useToast } from "@/components/app/ui/toast";
import { IconLock } from "@/components/icons";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * A calm nudge at the top of Sites for members without two-factor. "optional": nobody requires it,
 * and "Skip for now" hides it for 30 days. "deferred": their organization requires it and they
 * skipped setup; it shows the deadline and can't be dismissed.
 */
export function MfaPrompt({ kind, orgName, deadline }: { kind: "optional" | "deferred"; orgName?: string; deadline?: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  const deferred = kind === "deferred";
  return (
    <section aria-labelledby="mfa-prompt-title" className="mb-6 flex flex-wrap items-center gap-4 rounded-[16px] border border-line bg-surface px-5 py-4 sm:px-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-ink-2" aria-hidden>
        <IconLock size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="mfa-prompt-title" className="text-sm font-semibold text-ink">
          {deferred ? `Set up two-factor by ${day(deadline!)}` : "Protect your account with a passkey"}
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">
          {deferred
            ? `${orgName ?? "Your organization"} requires two-factor sign-in. After that date you'll need it to keep using Plain Theory.`
            : "Sign in with Face ID, Touch ID, Windows Hello or a security key after your password. It takes a minute."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/app/account#two-factor" variant="ghost">
          Set up
        </ButtonLink>
        {deferred ? null : (
          <Button
            variant="quiet"
            loading={pending}
            loadingLabel="Skipping"
            onClick={() =>
              start(async () => {
                const r = await dismissMfaPrompt();
                if (r?.error) return toast(r.error, "error");
                setHidden(true);
                if (r?.ok) toast(r.ok);
              })
            }
          >
            Skip for now
          </Button>
        )}
      </div>
    </section>
  );
}
