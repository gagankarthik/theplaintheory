"use client";

import { LockedAction, type UpgradeOffer } from "@/components/app/billing/upgrade-dialog";
import { IconPlus } from "@/components/icons";

/** Invite, locked: every seat on the plan is taken, so it offers the plans with more seats. */
export function TeamInviteAction({ offer, seats }: { offer: UpgradeOffer; seats: number }) {
  return (
    <LockedAction
      label="Invite"
      icon={<IconPlus size={18} />}
      title="Add more seats to invite your team"
      reason={`Your plan includes ${seats} seat${seats === 1 ? "" : "s"}, and ${seats === 1 ? "it's" : "they're all"} in use. Pick a plan to invite teammates.`}
      unlocks={(p) => (p.seats === null ? "Unlimited team seats with roles" : `${p.seats} team seats with roles`)}
      offer={offer}
    />
  );
}
