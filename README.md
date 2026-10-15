# The Plain Theory

A consent management platform for GDPR, CCPA/CPRA and India's DPDPA. It has four parts:

- **`plain-consent.js`**: an embeddable script, about 6.4 KB gzipped, that holds trackers until a visitor chooses.
- **A region-aware banner**: GDPR, CCPA, DPDPA or a default notice, chosen from the visitor's location at the edge.
- **A tamper-evident consent log**: every decision is a SHA-256 hash-chained receipt.
- **A Next.js dashboard**: sites, banner builder, analytics, team roles, billing and log export.

It runs fully locally with no AWS account. Each AWS service is switched on with an environment variable.

## Architecture

```
                 ┌──────────────────────── Next.js app (dashboard + API) ───────────────────────┐
  Admin ───────► │  /app/*  dashboard (RSC + server actions)      /api/v1/*  public SDK API     │
                 │      │                                               │                        │
                 │      ▼                                               ▼                        │
                 │  src/lib/store ── local JSON  |  DynamoDB, six tables (KMS, PITR)             │
                 │  src/lib/auth  ── local scrypt |  Cognito user pool (MFA)                     │
                 │  src/lib/publish ─ local no-op |  S3 c/<siteKey>.json + CloudFront invalidation│
                 └──────────────────────────────────────────────────────────────────────────────┘
                                                   │ publish
                                                   ▼
                     ┌────────── CloudFront (OAC → private S3) ──────────┐
                     │ /sdk/v1/plain-consent.js     /c/<siteKey>.json     │  viewer-response function adds
                     └───────────────────────────────────────────────────┘  x-plain-country / x-plain-region
                                                   │
                                                   ▼
  Visitor ─► customer site ─► plain-consent.js ─► holds trackers ─► banner ─► choice
                                                   │                                  │
                                                   └── POST /api/v1/consent ◄─────────┘  receipt (hash-chained)
```

## Quick start

```bash
npm install
npm run dev
```

There's no seeded or mock data: every screen shows what's really in the store (the local JSON store in `.data/`, or
DynamoDB in production).

- Dashboard: create an account at http://localhost:3000/signup and set up your first workspace.
- Staff console: staff have their own invite-only Cognito pool. Invite yourself with
  `npm run staff:invite -- you@theplaintheory.in "Your Name" superadmin` (see [Staff accounts](#staff-accounts)), then
  sign in at http://localhost:3000/admin/login.
- Live SDK demo: http://localhost:3000/demo. It's a fake shop with held trackers, a state inspector and a country
  switcher (`?plain_country=DE|IN|BR`, `?plain_country=US&plain_region=CA`).

`npm run build` builds the SDK first and fails if it exceeds the 15 KB gzip budget (raised from PRD FR-3.1's 10 KB).

## Environment

Copy `.env.example` to `.env.local`. Locally every variable is optional: with none set, the app uses the local JSON
store, local auth, local publishing and the in-process fetch scanner. The canonical production URL is
**https://www.theplaintheory.in** (with `www`).

"Prod" says whether a production deployment needs it. Values below are examples, never real secrets.

**Core**

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical origin for metadata, sitemap, OG images and links in emails. Defaults to `https://www.theplaintheory.in` in production builds | `https://www.theplaintheory.in` |
| `SESSION_SECRET` | **Required** | Signs the session cookies (HS256). Sessions fail in production without it | output of `openssl rand -base64 48` |
| `MFA_ENCRYPTION_KEY` | **Required** | AES-256-GCM key for stored TOTP secrets: 32 bytes, base64. Falls back to a key derived from `SESSION_SECRET` | output of `openssl rand -base64 32` |
| `IP_HASH_SECRET` | **Required** | HMAC key for the truncated-IP keys used by rate limits and abuse windows. Requests that need it fail in production when unset (development and tests use a fixed key). Stored receipts use a separate daily salt that expires | output of `openssl rand -base64 48` |
| `INTERNAL_CRON_SECRET` | **Required** | Bearer token for the internal jobs `/api/internal/retention` and `/api/internal/scheduled-scans`. Vercel Cron's own `CRON_SECRET` is accepted too | output of `openssl rand -base64 48` |
| `CRON_SECRET` | Set in Vercel | Vercel Cron sends it as the bearer token on scheduled calls | random string |

**Drivers**

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `STORE_DRIVER` | **Required** (`dynamodb`) | `local` (`.data/` JSON files) or `dynamodb`. Also selects the DynamoDB-backed rate limiter | `dynamodb` |
| `AUTH_DRIVER` | **Required** (`cognito`) | `local` (scrypt hashes in the store) or `cognito` | `cognito` |
| `PUBLISH_DRIVER` | **Required** (`s3`) | `local` (served by `/api/v1/config`) or `s3` (S3 + CloudFront invalidation) | `s3` |
| `LOCAL_DATA_DIR` | No | Directory for the local store (default `.data`); the local crawler worker reads the same one | `.data` |

**AWS** (outputs of the CDK stacks; see [Deploying infrastructure](#deploying-infrastructure))

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `PT_AWS_REGION` | Recommended | Region of the data stack, which is also the data residency region. Falls back to `AWS_REGION`, then `ap-south-1` | `ap-south-1` |
| `PT_AWS_ACCESS_KEY_ID`, `PT_AWS_SECRET_ACCESS_KEY` | **Required** on Vercel | Keys of the least-privilege app IAM user. Prefixed `PT_` because Vercel overrides the standard `AWS_*` names. Unset: the SDK's default chain (your local profile) | `AKIA…` (fake) |
| `DYNAMO_TABLE_CORE`, `DYNAMO_TABLE_RECEIPTS`, `DYNAMO_TABLE_TELEMETRY`, `DYNAMO_TABLE_AUDIT`, `DYNAMO_TABLE_LEADS`, `DYNAMO_TABLE_EPHEMERAL` | Optional | Table names. Default `pt-prod-aps1-<table>`; set them for staging and dev stages | `pt-staging-aps1-core` |
| `CONFIG_BUCKET` | **Required** with `s3` | Bucket that receives `c/<siteKey>.json` | `pt-prod-aps1-config-123456789012` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Recommended | Invalidated on publish so visitors get the new config at once | `E1ABCDEFGHIJK` |
| `NEXT_PUBLIC_CDN_URL` | **Required** | Public CDN origin used in install snippets and published config URLs | `https://cdn.theplaintheory.in` |
| `COGNITO_REGION` | **Required** with `cognito` | Region of both user pools | `ap-south-1` |
| `COGNITO_CUSTOMER_POOL_ID`, `COGNITO_CUSTOMER_CLIENT_ID` | **Required** with `cognito` | Customers pool (self sign-up, `/login`) | `ap-south-1_AbCdEf123` |
| `COGNITO_CLIENT_SECRET` | Optional | Only if the customers app client was created with a secret | |
| `COGNITO_STAFF_POOL_ID`, `COGNITO_STAFF_CLIENT_ID` | **Required** | Staff pool (invite-only, TOTP required, `/admin/login`) | `ap-south-1_XyZ987abc` |
| `STAFF_REMEMBER_DEVICE` | Optional | `1` offers "Trust this browser for 30 days" at staff sign-in. Only after deploying the staff pool's device tracking | `1` |

**Email, billing and integrations**

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `MAIL_FROM` | **Required** | Sender on the SES-verified domain. Unset: no email is sent | `Plain Theory <no-reply@theplaintheory.in>` |
| `MAIL_CONFIGURATION_SET` | Recommended | SES configuration set from the Mail stack | `pt-prod-mail` |
| `STRIPE_SECRET_KEY` | Required for billing | Stripe API key. Checkout is disabled when unset; `npm run stripe:sync` creates the prices | `sk_live_…` (fake) |
| `STRIPE_WEBHOOK_SECRET` | Required for billing | Signing secret of the Stripe endpoint `https://www.theplaintheory.in/api/billing/webhook` (same handler as `/api/stripe/webhook`) | `whsec_…` (fake) |
| `SALES_WEBHOOK_URL` | Optional | Slack-compatible webhook for new contact-form leads | `https://hooks.slack.com/services/…` |
| `NEXT_PUBLIC_PLAIN_SITE_KEY` | Optional | Site key of our own marketing-site banner. Empty: no banner | `pk_…` |
| `NEXT_PUBLIC_DEMO_SITE_KEY` | Optional | Site key behind `/demo`. Empty: `/demo` is hidden | `pk_…` |

**Tracker crawler** ([`docs/architecture/crawler.md`](docs/architecture/crawler.md))

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `CRAWLER_QUEUE_URL` | Recommended | The Crawler stack's queue URL. Set: scans run in headless Chromium on ECS Fargate. Unset: the in-process HTML scan | `https://sqs.ap-south-1.amazonaws.com/123456789012/pt-prod-aps1-crawl-queue` |
| `CRAWLER_MODE` | No | `local` queues scans in the file store for the local worker (`npm run dev` in `services/crawler`) | `local` |

The worker in `services/crawler` has its own settings (`CRAWLER_WORKER_ID`, `CRAWLER_CONCURRENCY`,
`CRAWLER_POLL_INTERVAL_MS`, `CRAWLER_ALLOW_PRIVATE_NETWORK`, `PUPPETEER_EXECUTABLE_PATH`, `LOG_LEVEL`); the CDK
Crawler stack sets them on the Fargate task.

**Scripts only**: `APP_URL` (target of `npm run retention`, default `http://localhost:3000`), `STRIPE_SYNC_SITE_URL`
(`npm run stripe:sync`), `SHOT_BASE` and `CHROME_PATH` (`scripts/shot.mjs`).

### Scheduled jobs

`vercel.json` registers two daily Vercel Cron jobs (once a day fits every Vercel plan's cron limits):

| Path | Schedule (UTC) | What it does |
|---|---|---|
| `/api/internal/retention` | `30 20 * * *` | Deletes receipts, leak reports and webhook logs past their retention period |
| `/api/internal/scheduled-scans` | `0 21 * * *` | Starts a tracker scan for every site whose weekly or monthly schedule (Scanner page) is due, then sets its next due date |

Both take `GET` (Vercel Cron) or `POST` with `Authorization: Bearer <INTERNAL_CRON_SECRET>`, and `?dryRun=1` to
report without changing anything. Scheduled scans go through the same path as **Scan now**: one scan at a time per
site, and the per-site hourly scan limit applies.

## Deploying infrastructure

The AWS side is an AWS CDK v2 app in [`infra/`](infra/README.md), a separate npm package. In short:

1. At the repo root, build the SDK (`npm run sdk:build`); the Delivery stack uploads `public/sdk`.
2. In `infra/`: `npm install`, then `npx cdk bootstrap aws://<account>/ap-south-1` once per account.
3. Check with `npx cdk synth` (no AWS calls) and `npx cdk diff -c stage=<stage> …`, then deploy with
   `npx cdk deploy --all -c stage=<stage> -c vercelTeam=<team> -c sesDomain=theplaintheory.in -c alertEmail=<you>`.
   The stages are `prod`, `staging` and `dev`, each in its own account.
4. Build the crawler image with the CrawlerImages stack's CodeBuild project and pass it as
   `-c crawlerImage=<uri>:<tag>` (or `-c crawler=false` to leave the crawler out).
5. Copy the stack outputs into the environment variables above, add the SES DNS records, request SES production
   access and invite the first staff member.

[`infra/README.md`](infra/README.md) lists every stack, context flag and output, and maps each output to its variable.

## Staff accounts

Plain Theory's own team signs in to the staff console (`/admin`) through a separate Cognito user pool, never the
customers pool:

- **Invite-only.** Self sign-up is off. Cognito emails a temporary password (valid 1 day); the first sign-in at
  `/admin/login` sets a new password and an authenticator app. Every later sign-in asks for a TOTP code (Cognito
  enforces it).
- **Roles are groups.** `platform-superadmin`, `platform-support`, `platform-billing` and `platform-analyst` in the staff
  pool are the staff roles; the highest group wins. There's no copy in the data store.
- **Separate sessions.** A staff session has its own cookie (`pt_staff`, path `/admin`), a 1-hour idle timeout and an
  8-hour lifetime. A customer session never opens `/admin`, and a staff session never opens `/app`.
- **No self-service recovery.** A superadmin resets passwords, disables, re-enables or removes accounts at `/admin/staff`.
  Nobody can change their own account, and the last superadmin can't be demoted, disabled or removed.

Bootstrap the first superadmin (and anyone else, from the command line) with:

```bash
npm run staff:invite -- you@theplaintheory.in "Your Name" superadmin
npm run staff:invite -- you@theplaintheory.in "Your Name" superadmin --resend   # new temporary password
```

It reads `COGNITO_STAFF_POOL_ID` from `.env.local` and uses your AWS CLI credentials (default chain or `AWS_PROFILE`;
AWS keys that are only in `.env.local` are ignored), so run it from an admin profile.

## Project layout

```
sdk/src/                 the embeddable SDK (TypeScript, no dependencies)
  index.ts               orchestration + window.PlainConsent API
  config.ts              script-tag settings, config fetch, geo headers
  geo.ts                 country/region → framework
  blocker.ts             holds and releases scripts/iframes
  storage.ts             first-party consent cookie + localStorage mirror
  consent-mode.ts        Google Consent Mode v2 signals
  api.ts                 receipts (fetch keepalive) and events (sendBeacon)
  ui/                    shadow-DOM banner: styles, pure templates, renderer
scripts/build-sdk.mjs    esbuild → public/sdk/plain-consent.js, with the gzip budget check
src/app/(marketing)/     public website
src/app/(auth)/          sign in / sign up
src/app/app/             dashboard
src/app/api/v1/          public SDK API (CORS): config, consent, event, receipts
src/app/demo/            plain-HTML demo storefront running the real SDK
src/app/preview-frame/   iframe used by the banner builder's live preview
src/lib/                 domain logic: store drivers, auth, consent, crypto, geo, publish
infra/                   AWS CDK v2 app (separate package)
```

## Installing the SDK on a website

Put the script **first** in `<head>`. Scripts that the parser has already run can't be held.

```html
<script src="https://cdn.theplaintheory.in/sdk/v1/plain-consent.js" data-site="pk_your_site_key"></script>

<!-- Mark trackers you include yourself -->
<script type="text/plain" data-consent="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script type="text/plain" data-consent="marketing">/* Meta Pixel snippet */</script>
```

Scripts and iframes added later whose `src` matches a known tracker (Google Analytics, Meta Pixel, Hotjar,
Clarity, LinkedIn, TikTok, Google Ads, plus the trackers set for the site in the dashboard) are held
automatically and released when the visitor allows that category.

| Attribute | Default | |
|---|---|---|
| `data-site` | — | Site key from the dashboard |
| `data-api` | `<script origin>/api/v1` | Where receipts and events go |
| `data-config-url` | `<api>/config/<siteKey>` | Use the CDN URL in production: `https://cdn…/c/<siteKey>.json` |
| `data-debug` | off | Allows `?plain_country=` / `?plain_region=` overrides (always on for localhost) |

### JavaScript API

```js
PlainConsent.get();            // { framework, categories, decided, visitorId }
PlainConsent.acceptAll();
PlainConsent.rejectAll();
PlainConsent.set({ analytics: true });
PlainConsent.open();           // preferences dialog
PlainConsent.revoke();         // withdraw consent, logged as a receipt
const off = PlainConsent.on("change", (state) => {});
window.addEventListener("plainconsent:change", (e) => e.detail);

// Calls made before the script loads are queued:
window.PlainConsent = window.PlainConsent || [];
PlainConsent.push((api) => api.on("ready", console.log));
```

**Headless mode** (set in the dashboard): the SDK holds and releases trackers and logs receipts but renders no
UI, so you can build your own banner with the API above.

**Google Consent Mode v2**: `default` is pushed immediately with everything denied except `security_storage`,
and `update` follows each choice: marketing → `ad_*`, analytics → `analytics_storage`,
preferences → `functionality_storage` / `personalization_storage`.

**Accessibility**: the banner is a `region` landmark, and the modal layout is a `dialog` with a focus trap. Category
toggles are `switch`es. Escape closes preferences and focus returns to where it was. All controls are at least
24 px, focus is visible, the region's `lang` is set, and reduced-motion and forced-colors preferences are respected.

## Public API

All endpoints send CORS `*`. Errors share one shape: `{ "error": { "code", "message", "fields?" } }`.

| Method | Path | |
|---|---|---|
| GET | `/api/v1/config/:siteKey` | Published config. Sets `x-plain-country` / `x-plain-region` |
| POST | `/api/v1/consent` | `{siteKey, visitorId, action, framework, categories, configVersion}` → `201 {id, hash, seq}`. Origin must match the site's domain |
| POST | `/api/v1/event` | `{siteKey, kind: "view" \| "bounce"}` (text/plain accepted for sendBeacon) → `204` |
| GET | `/api/v1/receipts/:visitorId?siteKey=` | That visitor's own receipts (DPDPA summary) |

## Consent receipts

Each receipt stores the timestamp, framework, categories, action, config version, country, device, browser
and a salted hash of the **truncated** IP. The raw IP is never stored. Each receipt's hash is SHA-256 over its canonical fields, including the previous receipt's hash. That chains the
receipts per site, so editing or deleting any row breaks every hash after it. `verifyChain()` in `src/lib/crypto.ts`
re-checks a chain.

## Roadmap status (against the PRD)

**Phase 1, MVP**

- Done: SDK with Essential / Preferences / Analytics / Marketing categories, under 15 KB (CI-enforced).
- Done: Banner customizer (layout, colors, radius, font, copy) with a live preview.
- Done: Receipts in the local store and in DynamoDB (conditional-transaction hash chain).
- Done, as a driver: Cognito sign-up and sign-in. It's selected with `AUTH_DRIVER=cognito` and hasn't been tested against a live pool in this repo.

**Phase 2, Growth**

- Done: Geo routing (CloudFront Function in `infra/`, plus the same headers from the local API).
- Done: Opt-in, bounce and partial-consent analytics.
- Built: Tracker scanner. With `CRAWLER_QUEUE_URL` set, a headless Chromium crawler (Puppeteer, `services/crawler`, on ECS Fargate Spot) visits the site as a first-time visitor, so it executes JavaScript and records cookies (including HttpOnly), storage, scripts, embeds, pixels and what was set before consent. Without a queue, a fallback scan reads server HTML only. Scans can also run weekly or monthly on a schedule.
- Built, pending verification: Stripe Checkout and team roles. Both need real Stripe keys and a deployed environment to test.

**Phase 3, Enterprise: not started**

- Native mobile SDKs, cross-domain consent stitching, GTM / Segment / WordPress / Shopify integrations.

**Non-functional**

- The CDK provisions TLS 1.2+ with TLS 1.3 negotiated, AES-256 at rest (KMS), and residency through `dataRegion`.
- The < 50 ms delivery and 99.99% SLA targets are what the architecture is designed for. They haven't been measured.
- SOC 2 readiness is a process, not code.
