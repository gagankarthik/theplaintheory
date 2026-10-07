import type { Metadata } from "next";
import { MfaSection, PasswordSection, SessionsSection, type MfaRequirementInfo } from "@/components/app/account/account-security";
import { PageHeader } from "@/components/app/shell/page-header";
import { passwordHint } from "@/lib/auth/provider";
import { canSkipMfaSetup, hasTotp, mfaRequirementState, mfaSetupDeadline, passkeysOf } from "@/lib/auth/second-factor";
import { requireUser, sessionProblem } from "@/lib/auth/session";
import { parseUserAgent } from "@/lib/geo";
import { requestContext } from "@/lib/request-context";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Account" };

const describe = (ua: string) => {
  if (ua === "system") return "Script or tool";
  const { browser, device } = parseUserAgent(ua);
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? "macOS" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : null;
  return [browser === "Other" ? "Browser" : browser, os ? `on ${os}` : null, device !== "desktop" ? `(${device})` : null].filter(Boolean).join(" ");
};

export default async function AccountPage() {
  const ctx = await requireUser({ allowWithoutMfa: true });
  const { session, memberships } = ctx;
  let { user } = ctx;
  const store = await getStore();
  const [records, orgs, { userAgent }] = await Promise.all([store.listUserSessions(user.id), Promise.all(memberships.map((m) => store.getOrg(m.orgId))), requestContext()]);
  const requiring = orgs.find((o) => o?.security?.requireMfa);

  // Under a requiring organization, the first time this member sees the setup screen starts their
  // 7-day grace period; "Skip for now" is offered until it ends.
  let requirement: MfaRequirementInfo | null = null;
  if (requiring && !user.mfa) {
    if (!user.mfaSetupDeferredUntil) user = await store.updateUser(user.id, { mfaSetupDeferredUntil: mfaSetupDeadline(user) });
    const state = mfaRequirementState(requiring, user);
    requirement = {
      orgName: requiring.name,
      state: state === "deferred" ? "deferred" : "required",
      deadline: user.mfaSetupDeferredUntil!,
      canSkip: state === "required" && canSkipMfaSetup(user),
    };
  }

  const sessions = records
    .filter((r) => !sessionProblem(r))
    .sort((a, b) => (a.id === session.sid ? -1 : b.id === session.sid ? 1 : b.lastSeenAt.localeCompare(a.lastSeenAt)))
    .map((r) => ({ id: r.id, current: r.id === session.sid, device: describe(r.userAgent), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, expiresAt: r.expiresAt, mfaVerified: r.mfaVerified }));

  const passkeys = passkeysOf(user.mfa).map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt }));
  const totp = hasTotp(user.mfa);

  return (
    <>
      <PageHeader title="Account" description={`Sign-in security for ${user.email}.`} />
      <div className="max-w-5xl">
        <MfaSection
          enabled={Boolean(user.mfa)}
          enabledAt={user.mfa?.enabledAt}
          recoveryLeft={user.mfa?.recoveryCodes.length ?? 0}
          totp={totp}
          passkeys={passkeys}
          requirement={requirement}
          orgRequiring={requiring?.name}
          defaultPasskeyName={describe(userAgent).slice(0, 60) || "My passkey"}
        />
        <SessionsSection sessions={sessions} />
        <PasswordSection mfa={Boolean(user.mfa)} totp={totp} passkeys={passkeys.length > 0} changedAt={user.passwordChangedAt} hint={passwordHint()} />
      </div>
    </>
  );
}
