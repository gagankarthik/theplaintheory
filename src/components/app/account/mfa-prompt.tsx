"use client";

import { useState, useTransition } from "react";
import { dismissMfaPrompt } from "@/app/app/account/actions";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { useToast } from "@/components/app/ui/toast";
import { IconAlert, IconLock } from "@/components/icons";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Days left until the deadline, rounded up; 0 on the day itself. */
const daysUntil = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));

type Urgency = "info" | "warning" | "danger";

/** Colour by urgency: a suggestion is blue, a requirement with time left is orange, a near deadline is red. */
const STYLE: Record<Urgency, { box: string; icon: string; title: string }> = {
  info: { box: "border-info/30 bg-info-wash", icon: "bg-surface text-info ring-info/30", title: "text-ink" },
  warning: { box: "border-warning/35 bg-warning-wash", icon: "bg-surface text-warning ring-warning/35", title: "text-ink" },
  danger: { box: "border-destructive/35 bg-destructive-wash", icon: "bg-surface text-destructive ring-destructive/35", title: "text-destructive" },
};

/**
 * The two-factor nudge at the top of Sites, coloured by how urgent it is. "optional": nobody requires
 * it (blue, "Recommended"); "Skip for now" hides it for 30 days. "deferred": the organization requires
 * it and the member skipped setup: orange with the deadline, red in the last three days, and it can't
 * be dismissed. The words and the tag carry the meaning; the colour reinforces it.
 */
export function MfaPrompt({ kind, orgName, deadline }: { kind: "optional" | "deferred"; orgName?: string; deadline?: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  const deferred = kind === "deferred" && deadline;
  const left = deferred ? daysUntil(deadline) : null;
  const urgency: Urgency = !deferred ? "info" : left !== null && left <= 3 ? "danger" : "warning";
  const s = STYLE[urgency];

  return (
    <section
      aria-labelledby="mfa-prompt-title"
      role={urgency === "danger" ? "alert" : undefined}
      className={`mb-6 flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4 sm:px-6 ${s.box}`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset ${s.icon}`} aria-hidden>
        {urgency === "info" ? <IconLock size={18} /> : <IconAlert size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mfa-prompt-title" className={`text-sm font-semibold ${s.title}`}>
            {deferred ? `Set up two-factor by ${day(deadline)}` : "Protect your account with a passkey"}
          </h2>
          {urgency === "info" ? (
            <Badge tone="info">Recommended</Badge>
          ) : urgency === "warning" ? (
            <Badge tone="warning">Required by {day(deadline!)}</Badge>
          ) : (
            <Badge tone="danger">{left === 0 ? "Required today" : `Required in ${left} ${left === 1 ? "day" : "days"}`}</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-2">
          {deferred
            ? `${orgName ?? "Your organization"} requires two-factor sign-in. After that date you'll need it to keep using Plain Theory.`
            : "Sign in with Face ID, Touch ID, Windows Hello or a security key after your password. It takes a minute."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* required: setting it up is the thing to do, so it's the primary action here */}
        <ButtonLink href="/app/account#two-factor" variant={deferred ? "primary" : "secondary"}>
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
