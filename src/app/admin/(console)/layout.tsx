import { AdminShell, type AdminNavId } from "@/components/admin/admin-shell";
import { PLATFORM_ROLE_INFO, canPlatform } from "@/lib/auth/platform";
import { requireStaff } from "@/lib/auth/staff";

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

  return (
    <AdminShell user={{ name: staff.name, email: staff.email }} roleLabel={PLATFORM_ROLE_INFO[role].label} nav={nav}>
      {children}
    </AdminShell>
  );
}
