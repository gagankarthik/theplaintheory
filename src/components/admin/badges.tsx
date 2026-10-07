import { Badge } from "@/components/app/ui/badge";
import { PLATFORM_ROLE_INFO, type PlatformRole } from "@/lib/auth/platform";
import { planById } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

export function PlanBadge({ plan }: { plan: PlanId }) {
  return <Badge tone={plan === "free" ? "neutral" : "brand"}>{planById(plan).name}</Badge>;
}

export function OrgStatusBadge({ suspended }: { suspended: boolean }) {
  return suspended ? <Badge tone="declined">Suspended</Badge> : <Badge tone="released">Active</Badge>;
}

export function StaffRoleBadge({ role }: { role: PlatformRole | null }) {
  if (!role) return <span className="text-ink-3">None</span>;
  return <Badge tone={role === "superadmin" ? "brand" : "neutral"}>{PLATFORM_ROLE_INFO[role].label}</Badge>;
}

export function MfaBadge({ on }: { on: boolean }) {
  return on ? <Badge tone="released">On</Badge> : <Badge tone="held">Off</Badge>;
}
