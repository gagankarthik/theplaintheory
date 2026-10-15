import { hostname } from "node:os";

function intEnv(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export interface CrawlerConfig {
  workerId: string;
  /** CRAWLER_QUEUE_URL: SQS mode (AWS). Absent: poll the local file store for queued scans. */
  queueUrl: string | null;
  concurrency: number;
  pollIntervalMs: number;
  pageTimeoutMs: number;
  settleMs: number;
  pageDelayMs: number;
  visibilityTimeoutSec: number;
  heartbeatIntervalMs: number;
  /** Minimum gap between progress writes to the store. */
  progressIntervalMs: number;
  shutdownGraceMs: number;
}

export function loadConfig(): CrawlerConfig {
  return {
    workerId: process.env.CRAWLER_WORKER_ID || `${hostname()}-${process.pid}`,
    queueUrl: process.env.CRAWLER_QUEUE_URL || null,
    concurrency: Math.min(intEnv("CRAWLER_CONCURRENCY", 1, 1), 8),
    pollIntervalMs: intEnv("CRAWLER_POLL_INTERVAL_MS", 2000, 250),
    pageTimeoutMs: intEnv("CRAWLER_PAGE_TIMEOUT_MS", 30_000, 1000),
    settleMs: intEnv("CRAWLER_SETTLE_MS", 1500, 0),
    pageDelayMs: intEnv("CRAWLER_PAGE_DELAY_MS", 500, 0),
    visibilityTimeoutSec: intEnv("CRAWLER_VISIBILITY_TIMEOUT_SEC", 180, 30),
    heartbeatIntervalMs: intEnv("CRAWLER_HEARTBEAT_MS", 60_000, 5000),
    progressIntervalMs: intEnv("CRAWLER_PROGRESS_INTERVAL_MS", 1500, 0),
    shutdownGraceMs: intEnv("CRAWLER_SHUTDOWN_GRACE_MS", 25_000, 1000),
  };
}
