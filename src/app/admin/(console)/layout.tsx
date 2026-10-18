import { AdminShell, type AdminNavId } from "@/components/admin/admin-shell";
import { ThemeScript } from "@/components/theme/theme-script";
import { PLATFORM_ROLE_INFO, canPlatform } from "@/lib/auth/platform";
import { fmtDate } from "@/components/admin/format";
import { getTrustedDevice, requireStaff } from "@/lib/auth/staff";
import { staffRememberDeviceEnabled } from "@/lib/auth/staff-device";
import { getStore } from "@/lib/store";

/**
 * Staff console gate. Without a valid staff session (staff pool sign-in with TOTP) this redirects to
 * /admin/login; customer sessions don't count. Every page and action checks again.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { staff, role } = await requireStaff();

  const nav: AdminNavId[] = [
    "overview",
    "orgs",
    "users",
    ...(canPlatform(role, "leads:read") ? (["requests"] as const) : []),
    ...(canPlatform(role, "staff:manage") ? (["staff"] as const) : []),
    ...(canPlatform(role, "platform:audit") ? (["audit"] as const) : []),
  ];

  // Unanswered contact requests, as a count on the nav item so new submissions are seen on any page.
  const unanswered = canPlatform(role, "leads:read") ? (await (await getStore()).listLeads({ status: "new", limit: 100 })).length : 0;
  const badges = unanswered
    ? { requests: { text: unanswered >= 100 ? "99+" : String(unanswered), label: `${unanswered} unanswered contact request${unanswered === 1 ? "" : "s"}` } }
    : undefined;

  // "Trust this browser for 30 days" (STAFF_REMEMBER_DEVICE=1): whether this browser is trusted for this person.
  let trustedBrowsers: { thisBrowserUntil: string | null } | undefined;
  if (staffRememberDeviceEnabled()) {
    const t = await getTrustedDevice();
    const mine = t?.status === "valid" && t.device.sub === staff.sub;
    trustedBrowsers = { thisBrowserUntil: mine ? fmtDate(new Date(t.device.expiresAt).toISOString()) : null };
  }

  return (
    <>
    <ThemeScript />
    <AdminShell user={{ name: staff.name, email: staff.email }} roleLabel={PLATFORM_ROLE_INFO[role].label} nav={nav} badges={badges} trustedBrowsers={trustedBrowsers}>
      {children}
    </AdminShell>
    </>
  );
}
