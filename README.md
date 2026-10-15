# Plain Theory

**Consent, made plain.** Plain Theory is a consent management platform for GDPR and UK GDPR, CCPA/CPRA and the DPDP
Act. It shows each visitor the notice their law requires, holds trackers until they choose, and keeps every decision
as a tamper-evident receipt an auditor can verify.

Live at **[www.theplaintheory.in](https://www.theplaintheory.in)**.

---

## What it does

**Collect consent**

- **Region-aware banner.** GDPR, CCPA, DPDPA or a default notice, picked from the visitor's location at the edge. Bar,
  centred modal, corner toast or floating pill layouts, in the customer's brand and their visitors' languages.
- **Fair by design.** Reject always carries the same weight as Accept, and a fairness check blocks publishing banners
  that nudge visitors.
- **Banner studio.** Layout, colours, wording, purposes, custom CSS (sanitised) and a live preview. Every published
  version is kept.

**Hold trackers**

- **Real blocking.** Marked scripts and known trackers stay off until the visitor allows their category, including
  scripts and iframes injected later.
- **Google Consent Mode v2** signals, and **Global Privacy Control** honoured as an opt-out.
- **Leak alerts.** If a tracker fires after a visitor declines, the dashboard shows the page and the script.

**Find what a site sets**

- **Cookie scanner.** A headless Chromium crawler visits the site as a first-time visitor and records cookies
  (including HttpOnly), storage, scripts, embeds and pixels, and what loaded before consent. Scans run on demand or
  on a weekly or monthly schedule.
- **Cookie catalogue** with suggested categories, risk ratings and bulk review.

**Prove it**

- **Hash-chained receipts.** Every decision is a receipt that carries the hash of the one before it, so a changed or
  missing record shows. Verify a whole log in one click.
- **Evidence Pack and audit report** for auditors, with the banner shown and the signals honoured.
- **Analytics.** Opt-in, opt-out and partial rates, consent by category, and country, device and browser breakdowns.

**Run it as a team**

- Organizations with roles (Owner, Admin, Editor, Auditor), passkeys and TOTP two-factor, an Organization audit log,
  Stripe billing, webhooks, and a separate invite-only staff console.

---

## How it works

```
                 ┌──────────────────────── Next.js app (dashboard + API) ───────────────────────┐
  Admin ───────► │  /app/*  dashboard (RSC + server actions)      /api/v1/*  public SDK API     │
                 │      │                                               │                        │
                 │      ▼                                               ▼                        │
                 │  src/lib/store ── local JSON  |  DynamoDB, six tables (KMS, PITR)             │
                 │  src/lib/auth  ── local scrypt |  Cognito user pool (MFA)                     │
                 │  src/lib/publish ─ local no-op |  S3 c/<siteKey>.json + CloudFront invalidation│
                 └──────────────────────────────────────────────────────────────────────────────┘
                                │ publish                              │ scan request
                                ▼                                      ▼
                 ┌──── CloudFront (OAC → private S3) ────┐    ┌── SQS → ECS Fargate (Spot) ──┐
                 │ /sdk/v1/plain-consent.js              │    │ headless Chromium crawler    │
                 │ /c/<siteKey>.json  + geo headers      │    │ (services/crawler)           │
                 └───────────────────────────────────────┘    └──────────────────────────────┘
                                │
                                ▼
  Visitor ─► customer site ─► plain-consent.js ─► holds trackers ─► banner ─► choice
                                │                                                │
                                └── POST /api/v1/consent ◄───────────────────────┘  receipt (hash-chained)
```

Every AWS service sits behind a driver chosen by an environment variable, so the whole platform also runs locally
with no AWS account.

## Tech stack

| Area | Built with |
|---|---|
| App | Next.js 16 (App Router, React Server Components, server actions), React 19, TypeScript |
| UI | Tailwind CSS v4, a shared component kit (`src/components/app/ui`), Switzer and JetBrains Mono, light and dark themes |
| SDK | Dependency-free TypeScript, bundled with esbuild into one IIFE, rendered in a closed shadow root |
| Data | DynamoDB (single-table design, KMS, point-in-time recovery), conditional writes for the receipt chain |
| Auth | Amazon Cognito (customers and staff pools), passkeys (WebAuthn), TOTP |
| Delivery | S3 behind CloudFront with a viewer function for geo headers |
| Crawler | Node.js, Puppeteer and Chromium on ECS Fargate Spot, fed by SQS, scaling to zero |
| Infrastructure | AWS CDK v2 (`infra/`) |
| Billing and email | Stripe, Amazon SES |
| Hosting | Vercel (app), with Vercel Cron for scheduled jobs |
| Quality | Vitest (node and happy-dom), ESLint, GitHub Actions CI |

---

## Getting started

Requires **Node.js 22**.

```bash
npm install
npm run dev            # http://localhost:3000
```

With no environment variables set, the app uses the local JSON store in `.data/`, local password auth, local
publishing and the in-process scanner.

**Demo data.** To explore a populated dashboard:

```bash
npm run seed:dev       # demo Organization, two sites, trackers, scans, 30 days of receipts, leaks, webhooks
npm run dev:local      # next dev with the local store, auth and publish drivers forced on
```

Sign in as `demo@plaintheory.local`. The generated password is written to `.data/dev-credentials.json` (gitignored).
The seed refuses to run against DynamoDB, Cognito, production or Vercel, and running it twice changes nothing.
`npm run seed:dev -- --reset` rebuilds the demo data only.

**Also local:**

- **Dashboard:** create an account at http://localhost:3000/signup and set up your first Organization.
- **Staff console:** invite yourself with `npm run staff:invite` (see [Staff accounts](#staff-accounts)), then sign
  in at http://localhost:3000/admin/login.
- **SDK demo:** http://localhost:3000/demo is a storefront with held trackers, a state inspector and a country switcher
  (`?plain_country=DE|IN|BR`, `?plain_country=US&plain_region=CA`).
- **Crawler worker:** `npm run dev` in `services/crawler`, with `CRAWLER_MODE=local` in the app.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run dev:local` | Development server; `dev:local` forces the local drivers |
| `npm run build` | Builds the SDK, then the app |
| `npm test` | Unit and integration tests |
| `npm run lint` | ESLint |
| `npm run sdk:build` | Builds `public/sdk/plain-consent.js` |
| `npm run seed:dev` | Local demo data |
| `npm run retention` | Runs the retention job against `APP_URL` (`-- --dry-run` to preview) |
| `npm run stripe:sync` | Creates or updates Stripe products and prices |
| `npm run staff:invite` | Invites a staff member to the staff pool |

---

## Configuration

Copy `.env.example` to `.env.local`. Locally every variable is optional. The canonical production URL is
**https://www.theplaintheory.in** (with `www`).

"Prod" says whether a production deployment needs the variable. Examples are placeholders, never real secrets.

**Core**

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical origin for metadata, sitemap, OG images and links in emails. Defaults to `https://www.theplaintheory.in` in production builds, and the bare domain is always normalised to `www` | `https://www.theplaintheory.in` |
| `SESSION_SECRET` | **Required** | Signs the session cookies (HS256). Sessions fail in production without it | output of `openssl rand -base64 48` |
| `MFA_ENCRYPTION_KEY` | **Required** | AES-256-GCM key for stored TOTP secrets: 32 bytes, base64. Falls back to a key derived from `SESSION_SECRET` | output of `openssl rand -base64 32` |
| `IP_HASH_SECRET` | **Required** | HMAC key for the truncated-IP keys used by rate limits and abuse windows. Requests that need it fail in production when unset (development and tests use a fixed key). Stored receipts use a separate daily salt that expires | output of `openssl rand -base64 48` |
| `INTERNAL_CRON_SECRET` | **Required** | Bearer token for `/api/internal/retention` and `/api/internal/scheduled-scans`. Vercel Cron's own `CRON_SECRET` is accepted too | output of `openssl rand -base64 48` |
| `CRON_SECRET` | Set in Vercel | Vercel Cron sends it as the bearer token on scheduled calls | random string |

**Drivers**

| Variable | Prod | Purpose | Example |
|---|---|---|---|
| `STORE_DRIVER` | **Required** (`dynamodb`) | `local` (`.data/` JSON files) or `dynamodb`. Also selects the DynamoDB-backed rate limiter | `dynamodb` |
| `AUTH_DRIVER` | **Required** (`cognito`) | `local` (scrypt hashes in the store) or `cognito` | `cognito` |
| `PUBLISH_DRIVER` | **Required** (`s3`) | `local` (served by `/api/v1/config`) or `s3` (S3 + CloudFront invalidation) | `s3` |
| `LOCAL_DATA_DIR` | No | Directory for the local store (default `.data`); the local crawler worker reads the same one | `.data` |

**AWS** (outputs of the CDK stacks; see [Deployment](#deployment))

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
`CRAWLER_POLL_INTERVAL_MS`, `CRAWLER_SCAN_DEADLINE_MS`, `CRAWLER_ALLOW_PRIVATE_NETWORK`, `PUPPETEER_EXECUTABLE_PATH`,
`LOG_LEVEL`); the CDK Crawler stack sets them on the Fargate task.

**Scripts only**: `APP_URL` (target of `npm run retention`, default `http://localhost:3000`), `STRIPE_SYNC_SITE_URL`
(`npm run stripe:sync`), `SHOT_BASE` and `CHROME_PATH` (`scripts/shot.mjs`).

### Scheduled jobs

`vercel.json` registers two daily Vercel Cron jobs (once a day fits every Vercel plan's cron limits):

| Path | Schedule (UTC) | What it does |
|---|---|---|
| `/api/internal/retention` | `30 20 * * *` | Deletes receipts, leak reports and webhook logs past their retention period |
| `/api/internal/scheduled-scans` | `0 21 * * *` | Starts a tracker scan for every site whose weekly or monthly schedule is due, then sets its next due date |

Both take `GET` (Vercel Cron) or `POST` with `Authorization: Bearer <INTERNAL_CRON_SECRET>`, and `?dryRun=1` to
report without changing anything. Scheduled scans go through the same path as **Scan now**: one scan at a time per
site, and the per-site hourly scan limit applies.

---

## Deployment

**App.** `master` deploys to Vercel. Before pushing, run `npx tsc --noEmit`, `npm run lint`, `npm test` and
`npm run build`. Set the variables above in the Vercel project first, `IP_HASH_SECRET` in particular.

**Infrastructure.** The AWS side is an AWS CDK v2 app in [`infra/`](infra/README.md), a separate npm package:

1. At the repo root, build the SDK (`npm run sdk:build`); the Delivery stack uploads `public/sdk`.
2. In `infra/`: `npm install`, then `npx cdk bootstrap aws://<account>/ap-south-1` once per account.
3. Check with `npx cdk synth` (no AWS calls) and `npx cdk diff -c stage=<stage> …`, then deploy with
   `npx cdk deploy --all -c stage=<stage> -c vercelTeam=<team> -c sesDomain=theplaintheory.in -c alertEmail=<you>`.
   The stages are `prod`, `staging` and `dev`, each in its own account.
4. Copy the stack outputs into the environment variables above, add the SES DNS records, request SES production
   access and invite the first staff member.

**Crawler image.** Image tags are immutable and `latest` is rejected:

1. Deploy the `CrawlerImages` stack.
2. Run its CodeBuild project (`aws codebuild start-build`, optionally overriding `IMAGE_TAG` with the commit SHA).
3. Deploy the `Crawler` stack with `-c crawlerImage=<ImageUri>` (or `-c crawler=false` to leave the crawler out).
   Roll back by redeploying the previous tag.

[`infra/README.md`](infra/README.md) lists every stack, context flag and output, and maps each output to its variable.

## Staff accounts

Plain Theory's own team signs in to the staff console (`/admin`) through a separate Cognito user pool, never the
customers pool:

- **Invite-only.** Self sign-up is off. Cognito emails a temporary password (valid 1 day); the first sign-in at
  `/admin/login` sets a new password and an authenticator app. Every later sign-in asks for a TOTP code.
- **Roles are groups.** `platform-superadmin`, `platform-support`, `platform-billing` and `platform-analyst` in the staff
  pool are the staff roles; the highest group wins. There's no copy in the data store.
- **Separate sessions.** A staff session has its own cookie (`pt_staff`, path `/admin`), a 1-hour idle timeout and an
  8-hour lifetime. A customer session never opens `/admin`, and a staff session never opens `/app`.
- **No self-service recovery.** A superadmin resets passwords, disables, re-enables or removes accounts at `/admin/staff`.
  Nobody can change their own account, and the last superadmin can't be demoted, disabled or removed.

```bash
npm run staff:invite -- you@theplaintheory.in "Your Name" superadmin
npm run staff:invite -- you@theplaintheory.in "Your Name" superadmin --resend   # new temporary password
```

It reads `COGNITO_STAFF_POOL_ID` from `.env.local` and uses your AWS CLI credentials (default chain or `AWS_PROFILE`;
AWS keys that are only in `.env.local` are ignored), so run it from an admin profile.

---

## Installing the SDK on a website

Put the script **first** in `<head>`. Scripts that the parser has already run can't be held. The dashboard's Install
page gives each site its exact tag, with copy buttons, and guides for WordPress, Google Tag Manager and the common
frameworks.

```html
<script src="https://cdn.theplaintheory.in/sdk/v1/plain-consent.js" data-site="pk_your_site_key" data-gcm="true"></script>

<!-- Mark trackers you include yourself -->
<script type="text/plain" data-consent="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script type="text/plain" data-consent="marketing">/* Meta Pixel snippet */</script>
```

Scripts and iframes added later whose URL matches a known tracker (by hostname and path: Google Analytics, Meta Pixel,
Hotjar, Clarity, LinkedIn, TikTok, Google Ads, plus the trackers set for the site in the dashboard) are held
automatically and released when the visitor allows that category.

| Attribute | Default | |
|---|---|---|
| `data-site` | (required) | Site key from the dashboard |
| `data-gcm` | from the last config | `true` sends Consent Mode defaults before the config loads; the install snippet adds it when Consent Mode is on |
| `data-api` | `<script origin>/api/v1` | Where receipts and events go |
| `data-config-url` | `<api>/config/<siteKey>` | Use the CDN URL in production: `https://cdn…/c/<siteKey>.json` |
| `data-debug` | off | Allows `?plain_country=` / `?plain_region=` overrides (always on for localhost) |

Framework wrappers for React, Vue, Svelte and Angular live in [`packages/`](packages/README.md), and the WordPress
plugin in [`integrations/wordpress`](integrations/wordpress).

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

- **Headless mode** (set in the dashboard): the SDK holds and releases trackers and logs receipts but renders no UI,
  so you can build your own banner with the API above.
- **Google Consent Mode v2**: when enabled, `default` is pushed with everything denied except `security_storage`, and
  `update` follows each choice: marketing → `ad_*`, analytics → `analytics_storage`, preferences →
  `functionality_storage` / `personalization_storage`. When disabled, the SDK leaves Consent Mode alone.
- **Accessibility**: the banner is a `region` landmark, and the modal layout is a `dialog` with a focus trap. Category
  toggles are `switch`es. Escape closes preferences and focus returns to where it was. Controls are at least 24 px,
  focus is visible, the region's `lang` is set, and reduced-motion and forced-colors preferences are respected.

## Public API

All endpoints send CORS `*`. Errors share one shape: `{ "error": { "code", "message", "fields?" } }`. Requests are
rate-limited per visitor network through a shared store.

| Method | Path | |
|---|---|---|
| GET | `/api/v1/config/:siteKey` | Published config. Sets `x-plain-country` / `x-plain-region` |
| POST | `/api/v1/consent` | `{siteKey, visitorId, action, framework, categories, configVersion}` → `201 {id, hash, seq}`. Origin must match the site's domain |
| POST | `/api/v1/event` | `{siteKey, kind: "view" \| "bounce"}` (text/plain accepted for sendBeacon) → `204` |
| GET | `/api/v1/receipts/:visitorId?siteKey=` | That visitor's own receipts (DPDPA summary) |

---

## Security and privacy

- **No raw IPs, no fingerprints.** The SDK identifies a browser with a random 128-bit visitor ID kept in a first-party
  cookie. IPs are truncated (IPv4 `/24`, IPv6 first three groups) and hashed with a random salt that changes every UTC
  day and is deleted after about two days, so old hashes can't be reversed or linked across days.
- **Tamper-evident receipts.** Each receipt stores the decision, categories, framework, config version, language,
  country, device type, browser family, GPC and automation flags, and a SHA-256 hash over its canonical fields
  including the previous receipt's hash. Editing or deleting any row breaks every hash after it; `verifyChain()` in
  `src/lib/crypto.ts` re-checks a chain.
- **Retention by plan**, enforced daily by the retention job, with legal holds.
- **Crawler isolation.** Every request the crawler's Chromium makes passes a DNS-resolving guard against private,
  link-local and metadata addresses, including robots.txt redirects. Service workers are blocked, each scan has a
  time limit, and the container runs as non-root with a read-only root filesystem and no Linux capabilities.
- **Accounts.** Passkeys and TOTP, rate-limited sign-in with lockout, separate staff and customer sessions, and an
  append-only audit log.
- **Banner safety.** Banner copy, theme values and category ids are escaped in the SDK, and custom CSS is sanitised on
  save and again in the browser.

See [`SECURITY.md`](SECURITY.md) to report a vulnerability, and [`docs/soc2`](docs/soc2) for the control
documentation.

## Project structure

```
sdk/src/                 the embeddable SDK (TypeScript, no dependencies)
  index.ts               orchestration + window.PlainConsent API
  blocker.ts, match.ts   holds and releases scripts and iframes; hostname and path matching
  consent-mode.ts        Google Consent Mode v2 signals
  storage.ts             first-party consent cookie + localStorage mirror
  ui/                    shadow-DOM banner: styles, templates, renderer
scripts/                 SDK build (esbuild), demo seed, retention, Stripe sync, staff invites
src/app/(marketing)/     public website
src/app/(auth)/          sign in and sign up
src/app/app/             customer dashboard
src/app/admin/           staff console
src/app/api/             public SDK API (v1), internal cron jobs, billing webhooks
src/components/app/ui/   the shared component kit (see its README)
src/lib/                 domain logic: store drivers, auth, consent, crypto, geo, publish, analytics rollups
services/crawler/        headless Chromium tracker crawler (own package and tests)
packages/                React, Vue, Svelte and Angular wrappers around the SDK
integrations/wordpress/  WordPress plugin
examples/                demo site and a Vite + React example
infra/                   AWS CDK v2 app (own package)
tests/                   Vitest suites, including SDK tests on happy-dom
docs/                    architecture, SOC 2 controls, legal review, strategy
```

## Quality

```bash
npx tsc --noEmit         # types
npm run lint             # ESLint
npm test                 # app, SDK and integration tests
npm run build            # SDK + production build
(cd services/crawler && npm run typecheck && npm test)
```

CI (`.github/workflows/ci.yml`) runs type checks, lint, tests, the SDK build, the production build,
`npm audit --audit-level=high` and a secret scan on every push.

## Roadmap

**Shipped**

- SDK with Essential, Preferences, Analytics and Marketing categories, region-aware notices and Consent Mode v2.
- Banner studio with live preview, versioned publishing, custom CSS and four layouts.
- Hash-chained receipts in DynamoDB with one-click verification, the Evidence Pack and the audit report.
- Headless crawler on ECS Fargate Spot with scheduled scans, plus a server-HTML fallback.
- Analytics with daily rollups: opt-in, opt-out, partial and per-category consent.
- Organizations, roles, passkeys, TOTP, Stripe billing, webhooks and the staff console.

**Built, pending live verification**

- Stripe Checkout end to end, and the Cognito driver against a live pool in every stage.

**Next**

- Native mobile SDKs, cross-domain consent, more integrations (Segment, Shopify), and measured delivery latency and
  uptime targets.

---

© The Plain Theory. All rights reserved.
