import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLES, dynamo } from "./aws";
import type { RateLimitOptions, RateLimitResult, RateLimiter } from "./rate-limit";

/**
 * Shared rate limits for many short-lived serverless instances: one atomic counter per fixed window in
 * the ephemeral table (`RATE#<name>#<key>#<window>`, TTL one window after it closes).
 *
 * To keep the in-memory limiter's sliding behaviour, the previous window's count is carried in
 * proportion to how much of it still overlaps the sliding window (the usual two-window estimate).
 * A hit is recorded only if it fits, with the check and the increment in one conditional UpdateItem,
 * so concurrent requests can't overshoot and blocked hits aren't recorded.
 */
export function createDynamoRateLimiter(name: string, { limit, windowMs }: RateLimitOptions): RateLimiter {
  if (limit < 1 || windowMs <= 0) throw new Error("Rate limit needs a positive limit and window");
  const key = (k: string, w: number) => ({ PK: `RATE#${name}#${k}#${w}`, SK: "RATE" });

  async function counts(k: string, w: number) {
    const r = await dynamo().send(
      new BatchGetCommand({ RequestItems: { [TABLES.ephemeral]: { Keys: [key(k, w), key(k, w - 1)], ConsistentRead: true, ProjectionExpression: "PK, hits" } } }),
    );
    const items = r.Responses?.[TABLES.ephemeral] ?? [];
    const hitsOf = (pk: string) => Number(items.find((i) => i.PK === pk)?.hits ?? 0);
    return { current: hitsOf(key(k, w).PK), previous: hitsOf(key(k, w - 1).PK) };
  }

  function window(now: number) {
    const w = Math.floor(now / windowMs);
    const elapsed = now - w * windowMs;
    return { w, elapsed, untilEnd: windowMs - elapsed };
  }

  /** Hits the current window may still take, given the previous window's overlapping share. */
  const budget = (previous: number, elapsed: number) => limit - Math.floor(previous * (1 - elapsed / windowMs));

  const blocked = (untilEnd: number): RateLimitResult => ({ ok: false, limit, remaining: 0, retryAfterMs: Math.max(1000, untilEnd) });

  return {
    async consume(k, now = Date.now()) {
      const { w, elapsed, untilEnd } = window(now);
      const { previous } = await counts(k, w);
      const allowed = budget(previous, elapsed);
      if (allowed <= 0) return blocked(untilEnd);
      try {
        const r = await dynamo().send(
          new UpdateCommand({
            TableName: TABLES.ephemeral,
            Key: key(k, w),
            UpdateExpression: "ADD hits :one SET expiresAt = :ttl",
            ConditionExpression: "attribute_not_exists(hits) OR hits < :allowed",
            ExpressionAttributeValues: { ":one": 1, ":allowed": allowed, ":ttl": Math.ceil(((w + 2) * windowMs) / 1000) },
            ReturnValues: "UPDATED_NEW",
          }),
        );
        const hits = Number(r.Attributes?.hits ?? 1);
        return { ok: true, limit, remaining: Math.max(0, allowed - hits), retryAfterMs: 0 };
      } catch (e) {
        if (e instanceof ConditionalCheckFailedException || (e as { name?: string })?.name === "ConditionalCheckFailedException") return blocked(untilEnd);
        throw e;
      }
    },
    async peek(k, now = Date.now()) {
      const { w, elapsed, untilEnd } = window(now);
      const { current, previous } = await counts(k, w);
      const left = budget(previous, elapsed) - current;
      return left > 0 ? { ok: true, limit, remaining: left, retryAfterMs: 0 } : blocked(untilEnd);
    },
    async reset(k) {
      const w = Math.floor(Date.now() / windowMs);
      await Promise.all([key(k, w), key(k, w - 1)].map((Key) => dynamo().send(new DeleteCommand({ TableName: TABLES.ephemeral, Key }))));
    },
  };
}
