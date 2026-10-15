/**
 * Queue a crawl the way the dashboard's "Scan" button does (local file store), for development:
 *
 *   npm run request -- <propertyId> [--pages 10] [--depth 1]
 *
 * Uses the repository's .data store unless LOCAL_DATA_DIR is set. With no propertyId it lists the sites.
 */
import path from "node:path";
import { getStore, id, type ScanReport } from "../src/app";

process.env.LOCAL_DATA_DIR ??= path.resolve(import.meta.dirname, "../../../.data");

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const n = i > -1 ? Number.parseInt(process.argv[i + 1] ?? "", 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main(): Promise<void> {
  const store = await getStore();
  const propertyId = process.argv.slice(2).find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  if (!propertyId) {
    const orgs = await store.listOrgs?.().catch(() => []);
    console.log("usage: request <propertyId> [--pages N] [--depth N]");
    for (const org of orgs ?? []) {
      for (const p of await store.listProperties(org.id)) console.log(`  ${p.id}  ${p.domain}  (${org.name})`);
    }
    return;
  }
  const property = await store.getProperty(propertyId);
  if (!property) throw new Error(`No site ${propertyId}`);
  const now = new Date().toISOString();
  const limits = { maxPages: arg("pages", 10), maxDepth: arg("depth", 1) };
  const report: ScanReport = {
    id: id("scan", 8),
    propertyId,
    startedAt: now,
    finishedAt: "",
    status: "queued",
    engine: "headless",
    pages: [],
    findings: [],
    limits,
    progress: { pagesScanned: 0, pagesQueued: 1, findings: 0 },
    log: [{ at: now, level: "info", message: `Queued from the command line: up to ${limits.maxPages} pages, ${limits.maxDepth} links deep.` }],
  };
  await store.saveScan(report);
  console.log(`Queued ${report.id} for ${property.domain}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
