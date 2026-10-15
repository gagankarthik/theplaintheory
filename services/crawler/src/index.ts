import path from "node:path";
import { loadConfig } from "./config";

// Local mode shares the dashboard's file store: when started from services/crawler, default to the
// repository's .data folder (the store reads LOCAL_DATA_DIR lazily, on first use).
if (process.env.STORE_DRIVER !== "dynamodb" && !process.env.LOCAL_DATA_DIR && path.basename(path.dirname(process.cwd())) === "services") {
  process.env.LOCAL_DATA_DIR = path.resolve(process.cwd(), "../../.data");
}
import { runLocalConsumer } from "./consumers/local";
import { runSqsConsumer } from "./consumers/sqs";
import { logger } from "./logger";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = logger.child({ workerId: config.workerId });

  const shutdown = new AbortController();
  let signalled = false;
  const onSignal = (sig: NodeJS.Signals) => {
    if (signalled) {
      log.warn("Second signal received; exiting immediately", { signal: sig });
      process.exit(1);
    }
    signalled = true;
    log.info("Shutdown requested; stopping intake and handing in-flight scans back", { signal: sig });
    shutdown.abort();
    // Hard stop before ECS's stopTimeout sends SIGKILL.
    setTimeout(() => {
      log.error("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, config.shutdownGraceMs).unref();
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  process.on("unhandledRejection", (reason) => log.error("Unhandled promise rejection", { err: reason }));

  log.info("Crawler worker starting", {
    mode: config.queueUrl ? "sqs" : "local",
    store: process.env.STORE_DRIVER === "dynamodb" ? "dynamodb" : "file",
    concurrency: config.concurrency,
    node: process.version,
  });

  if (config.queueUrl) await runSqsConsumer(config, log, shutdown.signal);
  else await runLocalConsumer(config, log, shutdown.signal);
  log.info("Crawler worker stopped");
}

main().catch((err) => {
  logger.error("Crawler worker crashed", { err });
  process.exit(1);
});
