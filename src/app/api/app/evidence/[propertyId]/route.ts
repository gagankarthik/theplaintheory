import { recordAudit } from "@/lib/audit";
import { guardProperty } from "@/lib/auth/route-guard";
import { buildEvidencePack } from "@/lib/evidence";
import { planById } from "@/lib/plans";

/**
 * The Evidence Pack as JSON: { digest, pack }. `digest` is SHA-256 over the canonical JSON of
 * `pack` (keys sorted), so anyone can recompute it. Add ?download=1 to save it as a file.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/app/evidence/[propertyId]">) {
  const { propertyId } = await ctx.params;
  const g = await guardProperty(propertyId, "logs:export", "Your role can't export evidence.");
  if (!g.ok) return g.response;
  const { property, org, user, store } = g;
  const plan = planById(org.plan);
  if (!plan.limits.evidencePack) {
    return Response.json({ error: `The Evidence Pack is on Growth and above. ${org.name} is on ${plan.name}.` }, { status: 402 });
  }

  const { pack, digest } = await buildEvidencePack({ property, org, plan, user, store });
  const download = new URL(request.url).searchParams.get("download") === "1";
  await recordAudit({
    orgId: org.id,
    actor: { userId: user.id, email: user.email },
    action: "evidence.exported",
    target: { type: "property", id: property.id, label: property.domain },
    metadata: { download, chainOk: pack.chain.ok },
  });
  const name = `evidence-${property.domain}-${pack.generatedAt.slice(0, 10)}.json`;
  return new Response(JSON.stringify({ digest, algorithm: "sha256(canonical-json(pack))", pack }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(download ? { "content-disposition": `attachment; filename="${name}"` } : {}),
    },
  });
}
