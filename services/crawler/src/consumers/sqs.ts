import { ChangeMessageVisibilityCommand, DeleteMessageCommand, ReceiveMessageCommand, SQSClient, type Message } from "@aws-sdk/client-sqs";
import type { CrawlerConfig } from "../config";
import { claimScan, runClaimedScan, type JobOutcome } from "../jobs";
import type { Logger } from "../logger";
import { parseCrawlMessage } from "../messages";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });
}

/**
 * SQS consumer used on ECS Fargate. Each slot long-polls for one message at a time; while a crawl runs
 * a heartbeat keeps extending the message visibility so no other task picks it up. Messages are
 * deleted once handled (success or a recorded failure); if the task dies they reappear, the next
 * receive reclaims the scan left "running", and the queue's maxReceiveCount eventually redrives
 * poison messages to the DLQ.
 */
export async function runSqsConsumer(config: CrawlerConfig, log: Logger, shutdown: AbortSignal): Promise<void> {
  const queueUrl = config.queueUrl!;
  const sqs = new SQSClient({ region: process.env.PT_AWS_REGION || process.env.AWS_REGION || "ap-south-1" });

  const remove = (m: Message) => sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle! }));
  const setVisibility = (m: Message, seconds: number) =>
    sqs.send(new ChangeMessageVisibilityCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle!, VisibilityTimeout: seconds }));

  const handle = async (m: Message) => {
    const message = parseCrawlMessage(m.Body);
    if (!message) {
      log.error("Discarding malformed queue message", { messageId: m.MessageId, body: m.Body?.slice(0, 500) });
      await remove(m);
      return;
    }
    const receiveCount = Number(m.Attributes?.ApproximateReceiveCount ?? "1");
    const claimed = await claimScan(message.propertyId, message.scanId, config.workerId, receiveCount > 1);
    if (!claimed) {
      log.info("Scan not claimable (finished, cancelled or gone); dropping message", { ...message, receiveCount });
      await remove(m);
      return;
    }

    const heartbeat = setInterval(() => {
      setVisibility(m, config.visibilityTimeoutSec).catch((err) => log.warn("Visibility heartbeat failed", { err }));
    }, config.heartbeatIntervalMs);
    let outcome: JobOutcome;
    try {
      outcome = await runClaimedScan(claimed, { config, log, signal: shutdown });
    } finally {
      clearInterval(heartbeat);
    }
    if (outcome === "interrupted") {
      // Visible again right away so a healthy task restarts the crawl.
      await setVisibility(m, 0).catch((err) => log.warn("Could not release message", { err }));
    } else {
      await remove(m);
    }
    log.info("Crawl message handled", { ...message, outcome });
  };

  const slot = async (index: number) => {
    const slotLog = log.child({ slot: index });
    while (!shutdown.aborted) {
      try {
        const res = await sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
            VisibilityTimeout: config.visibilityTimeoutSec,
            MessageSystemAttributeNames: ["ApproximateReceiveCount"],
          }),
          { abortSignal: shutdown },
        );
        for (const m of res.Messages ?? []) {
          try {
            await handle(m);
          } catch (err) {
            // Infrastructure failure (DynamoDB unreachable, etc.): leave the message for a retry.
            slotLog.error("Message handling failed; leaving it on the queue for retry", { messageId: m.MessageId, err });
          }
        }
      } catch (err) {
        if (shutdown.aborted) break;
        slotLog.error("ReceiveMessage failed", { err });
        await sleep(5000, shutdown);
      }
    }
  };

  log.info("SQS consumer started", { queueUrl, concurrency: config.concurrency });
  await Promise.all(Array.from({ length: config.concurrency }, (_, i) => slot(i)));
  sqs.destroy();
}
