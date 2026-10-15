# Crawler

Headless Chromium tracker scanner for Plain Theory. It visits a site as a first-time visitor who has
not consented and records:
- every cookie, including `HttpOnly` cookies JavaScript can't see, read from the Chrome DevTools Protocol;
- `localStorage` and `sessionStorage` keys (names and value lengths only);
- third-party requests;
- tags in the rendered DOM.

The results are written to the site's scan report and folded into its tracker list, using the same
rules as the dashboard's built-in scan. See `docs/architecture/crawler.md` for the design.

## How it plugs into the app

- **Classification** reuses the app's own code from `src/lib` (bundled, not copied):
  - the 265-entry `TRACKER_DB` matchers;
  - `classifyPages` for the rendered HTML;
  - `candidatesFrom` / `mergeScan` for triage.
- **Storage** uses the same store as the dashboard (`getStore()`): the DynamoDB `core` table in AWS, the
  local file store in development.
- **Queue:** the dashboard queues a scan with `requestCrawl` (`src/lib/crawler`). The worker takes it
  `queued → running`, writes progress and log lines, and finishes `ok` or `failed`. A user cancel stops
  it at the next page.

## Run locally

```bash
cd services/crawler && npm ci
# dashboard, from the repo root: CRAWLER_MODE=local npm run dev
CRAWLER_ALLOW_PRIVATE_NETWORK=true npm run dev     # worker: polls the repo's .data store
npm run request -- <propertyId>                    # queue a crawl without the dashboard
npm run scan:once -- https://example.com --pages 5 # one-off scan, no store
```

To scan `localhost` you need `CRAWLER_ALLOW_PRIVATE_NETWORK=true`; see `examples/demo-site` for a local
test site.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `CRAWLER_QUEUE_URL` | — | SQS mode (AWS). Without it, the worker polls the local file store. |
| `STORE_DRIVER` | file store | `dynamodb` in AWS, set by the image. |
| `DYNAMO_TABLE_*`, `PT_AWS_REGION` | `pt-prod-aps1-*`, `ap-south-1` | Same table settings as the app. |
| `LOCAL_DATA_DIR` | `.data` | File store location (local mode). |
| `CRAWLER_ALLOW_PRIVATE_NETWORK` | `false` | Allows private and loopback addresses. Local development only. |
| `CRAWLER_CONCURRENCY` | `1` | Crawls one worker runs at once (each runs its own Chromium). |
| `CRAWLER_PAGE_TIMEOUT_MS` / `CRAWLER_SETTLE_MS` / `CRAWLER_PAGE_DELAY_MS` | `30000` / `1500` / `500` | Per-page timing. |
| `CRAWLER_PROGRESS_INTERVAL_MS` | `1500` | Minimum gap between progress writes. |
| `CRAWLER_VISIBILITY_TIMEOUT_SEC` / `CRAWLER_HEARTBEAT_MS` | `180` / `60000` | SQS message lease while a crawl runs. |
| `CRAWLER_SHUTDOWN_GRACE_MS` | `25000` | Time allowed after SIGTERM to hand the scan back before exiting. |
| `PUPPETEER_EXECUTABLE_PATH` | bundled Chrome | Debian `chromium` in the image. |
| `LOG_LEVEL` | `info` | JSON lines on stdout. |

## Security

- **Network guard:** every browser request is checked before it leaves (`src/net-guard.ts`). Hosts that are,
  or resolve to, private, loopback, link-local or cloud-metadata addresses are aborted, including the
  IPv4-mapped IPv6 forms.
- **Robots:** `robots.txt` is honoured.
- **Storage values:** values are never read, only their lengths.

## Build, test, image

```bash
npm run typecheck && npm test && npm run build    # tests include a real headless Chrome crawl
DOCKER_BUILDKIT=1 docker build -f services/crawler/Dockerfile -t pt-crawler .   # from the repo root
```

In AWS the image is built by the `CrawlerImages` CodeBuild project, so no local Docker is needed; see
`infra/README.md`.
