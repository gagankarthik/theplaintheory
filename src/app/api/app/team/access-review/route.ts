import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { guardOrg } from "@/lib/auth/route-guard";
import { csvResponse, csvRow } from "@/lib/csv";
import { getStore } from "@/lib/store";

const HEADER = [
  "kind",
  "name",
  "email",
  "role",
  "can_manage_team",
  "can_manage_billing",
  "mfa_enabled",
  "mfa_enabled_at",
  "last_active_utc",
  "member_since_utc",
  "invited_by",
  "password_changed_utc",
  "locked_until_utc",
  "reviewer_decision",
  "reviewer_notes",
];

/**
 * Quarterly access review (SOC 2 CC6.2, CC6.3): every member and pending invite with role, MFA status,
 * last activity and who granted access. Reviewers fill the last two columns and keep the file as evidence.
 */
export async function GET() {
  const g = await guardOrg("audit:read");
  if (!g.ok) return g.response;
  const store = await getStore();
  const [members, invites] = await Promise.all([store.listMembers(g.org.id), store.listInvites(g.org.id)]);

  const rows = [
    ...members
      .sort((a, b) => (a.user?.email ?? "").localeCompare(b.user?.email ?? ""))
      .map((m) =>
        csvRow([
          "member",
          m.user?.name ?? "Deleted user",
          m.user?.email ?? m.userId,
          m.role,
          can(m.role, "team:manage") ? "yes" : "no",
          can(m.role, "billing:manage") ? "yes" : "no",
          m.user?.mfa ? "yes" : "no",
          m.user?.mfa?.enabledAt ?? "",
          m.user?.lastActiveAt ?? "",
          m.createdAt,
          m.invitedBy ?? (m.role === "owner" ? "(created organization)" : ""),
          m.user?.passwordChangedAt ?? "",
          m.user?.lockedUntil && Date.parse(m.user.lockedUntil) > Date.now() ? m.user.lockedUntil : "",
          "",
          "",
        ]),
      ),
    ...invites.map((i) => csvRow(["pending-invite", "", i.email, i.role, can(i.role, "team:manage") ? "yes" : "no", can(i.role, "billing:manage") ? "yes" : "no", "", "", "", i.createdAt, i.invitedBy ?? "", "", "", "", ""])),
  ];

  await recordAudit({
    orgId: g.org.id,
    actor: { userId: g.user.id, email: g.user.email },
    action: "access_review.exported",
    target: { type: "org", id: g.org.id, label: g.org.name },
    metadata: { members: members.length, invites: invites.length, withoutMfa: members.filter((m) => m.user && !m.user.mfa).length },
  });

  const now = new Date().toISOString();
  const slug = g.org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
  return csvResponse(`access-review-${slug}-${now.slice(0, 10)}.csv`, HEADER, rows, `generated ${now} by ${g.user.email}; ${members.length} members, ${invites.length} pending invites`);
}
