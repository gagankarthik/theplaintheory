/**
 * One-shot scan without the store, printing classified findings.
 *
 *   npm run scan:once -- https://example.com [--depth 1] [--pages 5] [--json]
 *
 * Uses the same crawler and classifier as the worker. Private addresses are refused unless
 * CRAWLER_ALLOW_PRIVATE_NETWORK=true (needed for localhost fixtures).
 */
import { FindingCollector } from "./classify";
import { isAllowedUrl } from "./net-guard";
import { scanSite } from "./scanner/crawl";
import { buildStartUrl } from "./scanner/url";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const n = i > -1 ? Number.parseInt(process.argv[i + 1] ?? "", 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main(): Promise<void> {
  const target = process.argv.slice(2).find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  if (!target) {
    console.error("usage: scan:once <url-or-host> [--depth N] [--pages N] [--json]");
    process.exit(2);
  }
  const json = process.argv.includes("--json");
  const startUrl = buildStartUrl(target);
  if (!(await isAllowedUrl(startUrl))) {
    console.error(`${startUrl} resolves to a private address. Set CRAWLER_ALLOW_PRIVATE_NETWORK=true to scan local fixtures.`);
    process.exit(2);
  }
  const collector = new FindingCollector(new URL(startUrl).hostname);
  const result = await scanSite({
    startUrl,
    maxDepth: arg("depth", 1),
    maxPages: arg("pages", 5),
    guard: isAllowedUrl,
    onPage: (p) => collector.addHtmlPage(p),
    onLog: (level, message) => {
      if (!json && level !== "DEBUG") console.error(`[${level}] ${message}`);
    },
  });
  collector.setSiteHost(result.siteHost);
  collector.addRequestHosts(result.requestHosts);
  collector.addCookies(result.cookies);
  collector.addStorage(result.storage);
  const { findings, preConsent } = collector.result();

  if (json) {
    console.log(JSON.stringify({ startUrl: result.startUrl, pages: result.pages, findings, preConsent }, null, 2));
    return;
  }
  console.log(`\n${result.pages.length} page(s) from ${result.startUrl}`);
  const rows = findings.map((f) => ({
    kind: f.kind,
    name: f.name,
    category: f.category ?? "(review)",
    party: f.party,
    host: f.host,
    expiry: f.expiry ?? "",
    flags: [f.httpOnly ? "HttpOnly" : "", f.secure ? "Secure" : "", f.sameSite ?? "", f.storage && f.storage !== "cookie" ? f.storage : ""].filter(Boolean).join(" "),
  }));
  console.table(rows);
  if (preConsent.length) console.log(`Loaded before consent: ${preConsent.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
