"use client";

import { revokeAllSessions, unlockUser } from "@/app/admin/actions";
import { ActionDialog } from "./action-dialog";

export function UserActions({
  user,
  canUnlock,
  canRevoke,
}: {
  user: { id: string; email: string; locked: boolean; failures: number; activeSessions: number; self: boolean };
  canUnlock: boolean;
  canRevoke: boolean;
}) {
  if (!canUnlock && !canRevoke) return null;
  const nothingToUnlock = !user.locked && user.failures === 0;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
      {canUnlock ? (
        <ActionDialog
          trigger="Unlock account"
          title={`Unlock ${user.email}?`}
          description="Clears the sign-in lockout and the failed-attempt count. Only do this after confirming who you're talking to."
          confirmLabel="Unlock account"
          pendingLabel="Unlocking"
          action={unlockUser}
          hidden={{ userId: user.id }}
          disabled={nothingToUnlock}
          disabledReason={nothingToUnlock ? "Not locked, no failed sign-ins." : undefined}
        />
      ) : null}
      {canRevoke ? (
        <ActionDialog
          trigger="Sign out everywhere"
          triggerVariant="danger"
          danger
          title={`Sign ${user.email} out everywhere?`}
          description={
            user.self
              ? "Ends your other sessions. This browser stays signed in."
              : `Ends ${user.activeSessions === 1 ? "their 1 active session" : `all ${user.activeSessions} of their active sessions`}. They'll need to sign in again, with two-factor if they use it.`
          }
          confirmLabel="Sign out everywhere"
          pendingLabel="Signing out"
          action={revokeAllSessions}
          hidden={{ userId: user.id }}
          disabled={user.activeSessions === 0}
          disabledReason={user.activeSessions === 0 ? "No active sessions." : undefined}
        />
      ) : null}
    </div>
  );
}
