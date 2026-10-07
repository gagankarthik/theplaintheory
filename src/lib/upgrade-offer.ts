import "server-only";
import type { UpgradeOffer } from "@/components/app/billing/upgrade-dialog";
import { can } from "@/lib/auth/rbac";
import { getStripe } from "@/lib/billing";
import { PLANS, SELF_SERVE_PLANS, type Plan } from "@/lib/plans";
import { getCatalog, getLivePlans } from "@/lib/stripe-catalog";
import type { Organization, Role } from "@/lib/types";

/**
 * The plans that unlock a feature, with live Stripe prices, for the shared upgrade dialog.
 * `unlocks` says whether a plan includes the feature; the current plan and Free are never offered.
 */
export async function upgradeOffer(org: Pick<Organization, "plan" | "stripeCustomerId">, role: Role, unlocks: (plan: Plan) => boolean): Promise<UpgradeOffer> {
  const [livePlans, catalog] = await Promise.all([getLivePlans(), getCatalog()]);
  return {
    plans: livePlans.filter((p) => SELF_SERVE_PLANS.some((s) => s.id === p.id) && p.id !== "free" && p.id !== org.plan && unlocks(p)),
    purchasable: Object.fromEntries(PLANS.map((p) => [p.id, { monthly: Boolean(catalog?.[p.id]?.priceId.monthly), annual: Boolean(catalog?.[p.id]?.priceId.annual) }])),
    canBill: can(role, "billing:manage"),
    usePortal: org.plan !== "free" && Boolean(org.stripeCustomerId && getStripe()),
  };
}
