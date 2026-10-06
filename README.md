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
                 │  src/lib/store ── local JSON  |  DynamoDB single table (KMS, PITR)            │
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
npm run seed      # demo org, user and a published site (siteKey pk_demo_store, domain localhost)
npm run dev
```

- Dashboard: http://localhost:3000/login, signed in as `demo@theplaintheory.com` / `plain-demo-2026`
- Live SDK demo: http://localhost:3000/demo. It's a fake shop with held trackers, a state inspector and a country
  switcher (`?plain_country=DE|IN|BR`, `?plain_country=US&plain_region=CA`).

`npm run build` builds the SDK first and fails if it exceeds the 10 KB gzip budget (PRD FR-3.1).

## Environment

Copy `.env.example` to `.env.local`. All variables are optional locally.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and OG images |
| `SESSION_SECRET` | Signs the dashboard session cookie (HS256). **Required in production** |
| `IP_HASH_SALT` | Salt for hashing truncated visitor IPs in receipts |
| `STORE_DRIVER` | `local` (`.data/`) or `dynamodb` |
| `AUTH_DRIVER` | `local` (scrypt hashes) or `cognito` |
| `PUBLISH_DRIVER` | `local` (served by `/api/v1/config`) or `s3` (S3 + CloudFront invalidation) |
| `LOCAL_DATA_DIR` | Directory for the local store (default `.data`) |
| `AWS_REGION` | Region of the data stack, which is also the data residency region |
| `DYNAMO_TABLE` | Single-table name |
| `CONFIG_BUCKET` | Bucket that receives `c/<siteKey>.json` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Invalidated on publish |
| `NEXT_PUBLIC_CDN_URL` | Public CDN origin used in install snippets |
| `COGNITO_REGION`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET` | Cognito app client (secret only if the client has one) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_GROWTH` | Billing. Checkout is disabled when unset |

`infra/README.md` maps each variable to its CDK stack output.

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
<script src="https://cdn.theplaintheory.com/sdk/v1/plain-consent.js" data-site="pk_your_site_key"></script>

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

- Done: SDK with Essential / Preferences / Analytics / Marketing categories, under 10 KB (CI-enforced).
- Done: Banner customizer (layout, colors, radius, font, copy) with a live preview.
- Done: Receipts in the local store and in DynamoDB (conditional-transaction hash chain).
- Done, as a driver: Cognito sign-up and sign-in. It's selected with `AUTH_DRIVER=cognito` and hasn't been tested against a live pool in this repo.

**Phase 2, Growth**

- Done: Geo routing (CloudFront Function in `infra/`, plus the same headers from the local API).
- Done: Opt-in, bounce and partial-consent analytics.
- Built: Tracker scanner. It fetches the site's HTML and matches known tracker patterns, but it doesn't execute JavaScript, so it can't see trackers that load only at runtime.
- Built, pending verification: Stripe Checkout and team roles. Both need real Stripe keys and a deployed environment to test.

**Phase 3, Enterprise: not started**

- Native mobile SDKs, cross-domain consent stitching, GTM / Segment / WordPress / Shopify integrations.

**Non-functional**

- The CDK provisions TLS 1.2+ with TLS 1.3 negotiated, AES-256 at rest (KMS), and residency through `dataRegion`.
- The < 50 ms delivery and 99.99% SLA targets are what the architecture is designed for. They haven't been measured.
- SOC 2 readiness is a process, not code.
