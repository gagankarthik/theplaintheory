# Headless tracker crawler

Status: implemented on `feat/crawler-platform`, not yet deployed. Owner: platform team.

## Why

The dashboard's built-in scan (`src/lib/scan.ts`) reads server HTML with `fetch`. It finds declared
tags and `Set-Cookie` headers, but it misses three things:
- tags a tag manager injects at runtime;
- cookies set from JavaScript;
- storage keys.

It also can't tell what actually fired for a visitor who hasn't decided yet. The crawler runs real
Chromium and closes those gaps without changing how findings are triaged.

## Flow

```
Dashboard "Scan"  ─ scanTrackers ─▶ requestCrawl (src/lib/crawler)
                                      │  saves ScanReport {status: queued, engine: headless, limits}
                                      ├─ AWS:   SQS pt-{stage}-aps1-crawl-queue  {type: CRAWL, propertyId, scanId}
                                      └─ local: (file store; the worker polls listQueuedScans)
Crawler worker (services/crawler, ECS Fargate Spot, scales 0→N on queue depth)
  claim      updateScan(status running, ifStatus [queued])     one worker wins
  crawl      BFS over same-site links, robots.txt, per-page CDP capture, SSRF guard on every request
  progress   updateScan(progress, log, ifStatus [running])     a cancel makes this fail → crawl stops
  classify   classifyPages(rendered DOM) + TRACKER_DB matchUrl/matchCookie on network, jar, storage
  finish     updateScan(status ok|failed, findings, pages, preConsent)
  merge      mergeScan(candidatesFrom(findings)) → updateProperty(trackerPatch(...))
  audit      appendAudit tracker.scan_run (actor system:crawler)
Dashboard polls getScanStatus(propertyId, scanId) until the report is no longer queued/running.
```

## Contract

The contract lives in `src/lib/trackers.ts` and `src/lib/crawler/index.ts`.

- **Statuses:** `ScanReport.status` is one of `queued`, `running`, `ok`, `failed` or `cancelled`.
  `finishedAt` is `""` until the scan finishes.
- **New report fields:** `engine`, `progress`, `log` (at most 200 lines), `limits`, `preConsent` (the names
  of non-essential trackers that loaded before any consent) and `workerId`.
- **New fields on cookie findings:** `httpOnly`, `secure`, `sameSite` and `storage`.
- **Store additions (both drivers):** `getScan`, `updateScan` (patches in place; with `ifStatus` it acts as a
  compare-and-set) and `listQueuedScans` (file store only; DynamoDB returns `[]` because SQS is the queue).
- **Engine selection:** `crawlerMode()` returns `headless-sqs` when `CRAWLER_QUEUE_URL` is set,
  `headless-local` when `CRAWLER_MODE=local`, and `fetch` otherwise (the in-process scan, unchanged behaviour).
- **Stale scans:** `activeScan()` marks a scan with no progress for 15 minutes as failed, so a crashed
  worker never blocks the next scan.

## Data and permissions

- **Where reports live:** scan reports stay where they always were, in `core` at `PROP#<id> / SCAN#<at>#<id>`,
  keeping the newest 20 with a 180-day TTL. Updates are optimistic: read, then a conditional `Put` on the
  unchanged status.
- **Worker task role:**
  - `core`: read, `PutItem`, `UpdateItem`.
  - `audit`: read and `PutItem`, with update and delete explicitly denied.
  - KMS use on the data key, and SQS consume.
- **App policy (`pt-{stage}-app`):** gains `sqs:SendMessage` on the crawl queue.

## Network and safety

- **Subnets:** public subnets only, with no NAT gateway. Tasks need outbound internet and accept no
  inbound traffic. DynamoDB traffic uses a gateway endpoint.
- **SSRF guard:** every Chromium request is intercepted. Hosts resolving to private, loopback, link-local
  or metadata ranges (including IPv4-mapped IPv6) are aborted and logged as warnings.
- **Data minimisation:** storage values are never read, only their lengths.

## Operations

| Signal | Where |
| --- | --- |
| Worker logs | CloudWatch `/pt/{stage}/crawler` (JSON lines) |
| Failed requests | Dead-letter queue `pt-{stage}-aps1-crawl-dlq`, alarm `pt-{stage}-aps1-crawler-dlq` |
| Backlog | Alarm `pt-{stage}-aps1-crawler-queue-age` (oldest request older than 15 minutes) |
| Image builds | CodeBuild `pt-{stage}-aps1-crawler-image`, logs `/pt/{stage}/crawler-image` |

### Deploy (no local Docker needed)

```bash
cd infra
npx cdk deploy PlainTheory-Staging-CrawlerImages -c stage=staging
aws codebuild start-build --project-name pt-staging-aps1-crawler-image --region ap-south-1
# wait for SUCCEEDED, then use the RepositoryUri and ImageTag outputs:
npx cdk deploy PlainTheory-Staging-Crawler PlainTheory-Staging-Access -c stage=staging \
  -c crawlerImage=<RepositoryUri>:<ImageTag>
```

Then set `CRAWLER_QUEUE_URL` (the Crawler stack's `CrawlQueueUrl` output) in the Vercel environment for
that stage. Without it the dashboard keeps using the fetch scan.

## Not included

Scheduled (recurring) crawls are not implemented: scans run when someone presses Scan. A schedule could
be added later as an EventBridge rule that queues crawls for due sites.
