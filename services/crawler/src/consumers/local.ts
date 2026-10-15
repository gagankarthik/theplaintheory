import { getStore } from "../app";
import type { CrawlerConfig } from "../config";
import { runScan } from "../jobs";
import type { Logger } from "../logger";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });
}

/**
 * Local development consumer: polls the dashboard's file store (LOCAL_DATA_DIR) for queued scans
 * that the dashboard created with CRAWLER_MODE=local, and claims them atomically (queued → running).
 * Run the dashboard and this worker with the same LOCAL_DATA_DIR.
 */
export async function runLocalConsumer(config: CrawlerConfig, log: Logger, shutdown: AbortSignal): Promise<void> {
  if (process.env.STORE_DRIVER === "dynamodb") {
    log.error("Local polling needs the file store; with STORE_DRIVER=dynamodb set CRAWLER_QUEUE_URL (SQS) instead.");
    return;
  }
  const store = await getStore();
  log.info("Local consumer started", { dataDir: process.env.LOCAL_DATA_DIR ?? ".data (dashboard default)", concurrency: config.concurrency });

  const slot = async (index: number) => {
    const slotLog = log.child({ slot: index });
    while (!shutdown.aborted) {
      let ran = false;
      try {
        const queued = await store.listQueuedScans(config.concurrency * 2);
        for (const scan of queued) {
          if (shutdown.aborted) break;
          const outcome = await runScan(scan.propertyId, scan.id, { config, log: slotLog, signal: shutdown });
          if (outcome === "skipped") continue; // another slot won the claim
          ran = true;
          slotLog.info("Crawl handled", { propertyId: scan.propertyId, scanId: scan.id, outcome });
          break;
        }
      } catch (err) {
        slotLog.error("Polling failed", { err });
      }
      if (!ran) await sleep(config.pollIntervalMs, shutdown);
    }
  };

  await Promise.all(Array.from({ length: config.concurrency }, (_, i) => slot(i)));
}
