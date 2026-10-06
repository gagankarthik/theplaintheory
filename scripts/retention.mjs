// Runs the data-retention job against a running app: `npm run retention` (add `-- --dry-run` to preview).
// Production schedules the same endpoint daily; see docs/soc2/data-retention-and-disposal-policy.md.
const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.INTERNAL_CRON_SECRET ?? "dev-only-cron-secret";
const dryRun = process.argv.includes("--dry-run");

const res = await fetch(`${base}/api/internal/retention${dryRun ? "?dryRun=1" : ""}`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`retention failed (${res.status}):`, body.error ?? body);
  process.exit(1);
}
const t = body.totals;
console.log(`${dryRun ? "[dry run] would remove" : "removed"} ${t.receiptsRemoved} receipts, ${t.leaksRemoved} leak reports, ${t.deliveriesRemoved} webhook deliveries; ${t.propertiesSkipped} properties skipped (chain broken)`);
for (const org of body.orgs) {
  for (const p of org.properties) {
    const cp = p.checkpoint ? `checkpoint seq ${p.checkpoint.seq} (${p.checkpoint.removedCount} removed in total)` : "no checkpoint";
    console.log(`  ${org.name} / ${p.domain}: ${p.receiptsRemoved} receipts past ${org.logRetentionDays} days, ${cp}${p.skipped ? " SKIPPED: chain broken" : ""}`);
  }
}
