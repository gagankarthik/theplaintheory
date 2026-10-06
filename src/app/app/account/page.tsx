import type { Metadata } from "next";
import { MfaSection, PasswordSection, SessionsSection } from "@/components/app/account/account-security";
import { PageHeader } from "@/components/app/shell/page-header";
import { requireUser, sessionProblem } from "@/lib/auth/session";
import { parseUserAgent } from "@/lib/geo";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Account" };

const describe = (ua: string) => {
  if (ua === "system") return "Script or tool";
  const { browser, device } = parseUserAgent(ua);
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? "macOS" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : null;
  return [browser === "Other" ? "Browser" : browser, os ? `on ${os}` : null, device !== "desktop" ? `(${device})` : null].filter(Boolean).join(" ");
};

export default async function AccountPage(props: PageProps<"/app/account">) {
  const { user, session, memberships } = await requireUser({ allowWithoutMfa: true });
  const store = await getStore();
  const [records, orgs] = await Promise.all([store.listUserSessions(user.id), Promise.all(memberships.map((m) => store.getOrg(m.orgId)))]);
  const requiring = orgs.find((o) => o?.security?.requireMfa);
  const { mfa } = await props.searchParams;

  const sessions = records
    .filter((r) => !sessionProblem(r))
    .sort((a, b) => (a.id === session.sid ? -1 : b.id === session.sid ? 1 : b.lastSeenAt.localeCompare(a.lastSeenAt)))
    .map((r) => ({ id: r.id, current: r.id === session.sid, device: describe(r.userAgent), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, expiresAt: r.expiresAt, mfaVerified: r.mfaVerified }));

  return (
    <>
      <PageHeader title="Account" description={`Sign-in security for ${user.email}.`} />
      <div className="max-w-5xl">
        <MfaSection
          enabled={Boolean(user.mfa)}
          enabledAt={user.mfa?.enabledAt}
          recoveryLeft={user.mfa?.recoveryCodes.length ?? 0}
          required={mfa === "required" || Boolean(requiring)}
          orgRequiring={requiring?.name}
        />
        <SessionsSection sessions={sessions} />
        <PasswordSection mfa={Boolean(user.mfa)} changedAt={user.passwordChangedAt} managedExternally={process.env.AUTH_DRIVER === "cognito"} />
      </div>
    </>
  );
}
