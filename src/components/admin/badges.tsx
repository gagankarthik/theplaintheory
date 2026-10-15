import { Badge } from "@/components/app/ui/badge";
import { PLATFORM_ROLE_INFO, type PlatformRole } from "@/lib/auth/platform";
import { planById } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

/** Paid plans get the outlined "info" pill so they stand out from Free in a dense list; lime stays for "current". */
export function PlanBadge({ plan }: { plan: PlanId }) {
  return <Badge tone={plan === "free" ? "neutral" : "info"}>{planById(plan).name}</Badge>;
}

export function OrgStatusBadge({ suspended }: { suspended: boolean }) {
  return suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>;
}

export function StaffRoleBadge({ role }: { role: PlatformRole | null }) {
  if (!role) return <span className="text-ink-3">None</span>;
  return <Badge tone={role === "superadmin" ? "info" : "neutral"}>{PLATFORM_ROLE_INFO[role].label}</Badge>;
}

export function MfaBadge({ on }: { on: boolean }) {
  return on ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>;
}

/** Owner / admin / member etc. inside an organization. */
export function MemberRoleBadge({ role }: { role: string }) {
  return (
    <Badge tone={role === "owner" ? "info" : "neutral"} className="capitalize">
      {role}
    </Badge>
  );
}
