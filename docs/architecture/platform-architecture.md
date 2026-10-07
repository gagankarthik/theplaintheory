# Plain Theory: platform architecture, identity and roles

Status: **deployed** to the `prod` stage in ap-south-1 (account 417915984158), 2026-10-07. See [Decisions](#decisions).
Owner: platform team. Last updated: 2026-10-07.

## 1. Summary

- **Hosting:** the Next.js app (marketing, dashboard, staff console, public consent API) runs on **Vercel**, pinned to `bom1` (Mumbai), next to the data.
- **AWS:** DynamoDB, Cognito, S3 + CloudFront, KMS and SES in **ap-south-1**. The only exception is the CloudFront certificate, which must be in us-east-1.
- **App to AWS:** a least-privilege IAM user, `pt-prod-vercel-app`, carrying two managed policies (`pt-prod-app`, `pt-prod-ingest`). Vercel OIDC roles are ready in the Access stack for when a team slug is supplied.
- **Two Cognito user pools,** so customers and our own team never share an identity store:
  - **Customers** (`pt-<stage>-aps1-customers`) sign up themselves. Their roles are **per organization**, stored in DynamoDB, because one person can be an Owner in one org and a Viewer in another.
  - **Staff** (`pt-<stage>-aps1-staff`, our company, our team) are **invite-only**, with TOTP two-factor enforced by Cognito. Membership of a `platform-*` group in that pool is the staff role. Staff sign in at `/admin/login` and get their own session cookie, separate from customer sessions.
- **Staff have no standing access to customers' consent records.** Support gets **time-boxed, reason-logged access** that the customer can see in their own audit log.
- **Every resource follows one naming scheme and one tag set,** enforced in CDK, so cost, ownership and compliance scope are always visible.

## 2. Environments and AWS accounts

Today's account (`oceanbluecorp-aws`, 417915984158) is the **AWS Organizations management account**. It also runs unrelated
workloads (HR, marketdesk, WhatsApp, resume tools). AWS's guidance is to keep workloads out of the management account. A
customer-data product with SOC 2 and DPDPA obligations especially benefits from its own boundary.

**Recommended:** two member accounts under the existing organization, created from the management account.

| Account | Purpose | Vercel environment |
|---|---|---|
| `plaintheory-prod` | Production data and identity only | Production |
| `plaintheory-nonprod` | `staging` and `dev` stages, seeded test data | Preview and Development |

Benefits:
- **Blast radius:** a mistake in another product can't touch consent records.
- **Clean evidence:** a clean IAM boundary for auditors.
- **Cost:** a separate bill per product.
- **Simple guardrails:** SCPs such as "deny regions outside ap-south-1, ap-south-2, eu-central-1, us-east-1" are easy to apply.

**Fallback** if separate accounts aren't possible yet: deploy into the shared account, isolated by naming, tags and a
permissions boundary on every `pt-*` role. The design below works either way, and it can be moved to its own accounts later
without changing the app.

**Stages:** `dev` (personal sandboxes, optional), `staging` (mirrors prod, fed by Vercel Preview), `prod`.

## 3. Architecture

```
                         ┌──────────── Visitors on customer sites ────────────┐
                         │                                                    │
             SDK + banner config (cached)                    consent decisions (POST)
                         │                                                    │
                ┌────────▼─────────┐                              ┌──────────▼──────────┐
                │ CloudFront       │  geo headers (CF Function)   │ Vercel  /api/v1/*   │
                │ pt-prod-cdn      │                              │ region bom1         │
                └────────┬─────────┘                              └──────────┬──────────┘
                         │ OAC                                               │ OIDC → IAM role
                ┌────────▼─────────┐                    ┌────────────────────▼───────────────────┐
                │ S3 config bucket │◄── publish ────────┤ Vercel Next.js app (bom1)              │
                └──────────────────┘   + invalidation   │  • marketing   • /app (customers)       │
                                                        │  • /admin (staff) • server actions      │
 Customers ─┐                                            │                                        │
 Staff     ─┴─ sign in ──► Cognito pt-prod-aps1-users   ◄┤                                        │
                                                        └───────┬───────────────────┬────────────┘
                                                                │                   │
                                                ┌───────────────▼──┐     ┌──────────▼──────────┐
                                                │ DynamoDB         │     │ DynamoDB            │
                                                │ pt-prod-aps1-core│     │ pt-prod-aps1-receipts│
                                                └──────────────────┘     └──────────┬──────────┘
                                                  KMS CMK (both)        stream (optional)
                                                                         ▼
                                                              Firehose → S3 archive (Object Lock) → Athena
 Email: SES (verified domain, DKIM) for Cognito mail, invites and alerts.
 Billing: Stripe (webhooks into Vercel). Scheduling: Vercel Cron → /api/internal/retention.
```

## 4. Naming convention

Pattern: **`pt-{stage}-{regionCode}-{component}[-{qualifier}]`**, all lower-case, hyphen-separated.

- Global resources (IAM, CloudFront) drop the region code.
- S3 buckets end with the account ID so they're globally unique.
- CloudFormation stacks use **`PlainTheory-{Stage}-{Component}`**.

Region codes: `aps1` (ap-south-1), `aps2` (ap-south-2), `euc1` (eu-central-1), `use1` (us-east-1).

| Resource | Example name |
|---|---|
| CDK stacks | `PlainTheory-Prod-Data`, `PlainTheory-Prod-Identity`, `PlainTheory-Prod-Delivery`, `PlainTheory-Prod-Access` |
| DynamoDB | `pt-prod-aps1-core`, `pt-prod-aps1-receipts` |
| Cognito user pool | `pt-prod-aps1-users` |
| Cognito app clients | `pt-prod-web` (in each pool) |
| Cognito groups | `platform-superadmin`, `platform-support`, `platform-billing`, `platform-analyst` |
| KMS alias | `alias/pt-prod-aps1-data` |
| S3 buckets | `pt-prod-aps1-config-417915984158`, `pt-prod-aps1-archive-417915984158` |
| CloudFront | comment `pt-prod-cdn`, domain `cdn.theplaintheory.in` |
| IAM roles | `pt-prod-vercel-runtime`, `pt-prod-cdk-deploy` |
| SES identity | `theplaintheory.in`, configuration set `pt-prod-mail` |
| Log groups | `/pt/prod/{component}` |
| Alarms | `pt-prod-{component}-{signal}`, e.g. `pt-prod-receipts-throttles` |

## 5. Tags

Every taggable resource gets these tags, applied once with `Tags.of(app)` and checked by a CDK Aspect that fails synth if one is missing:

| Tag | Values | Why |
|---|---|---|
| `Project` | `plain-theory` | Cost and ownership in a shared organization |
| `Environment` | `prod` / `staging` / `dev` | Guardrails, cost split |
| `Component` | `data` / `identity` / `delivery` / `access` / `archive` | Which stack owns it |
| `Owner` | `platform-team` | Who to page |
| `CostCenter` | `plain-theory` | Billing reports |
| `DataClassification` | `personal` / `confidential` / `public` | Receipts and identity are `personal`; the SDK bucket is `public` |
| `Compliance` | `dpdpa/gdpr/soc2` | Audit scope |
| `ManagedBy` | `cdk` | Don't hand-edit |
| `Repository` | `gagankarthik/theplaintheory` | Where the code lives |

Activate `Project`, `Environment` and `Component` as **cost allocation tags** in Billing. Add an **AWS Budgets** alert on `Project=plain-theory`.

## 6. Data layer (DynamoDB)

There are six tables, one per product domain. They're split because they differ in write volume, retention,
sensitivity and who may touch them. Splitting them lets each get its own TTL, IAM and scaling.

| Table | Holds | Volume | Retention | Classification | Written by |
|---|---|---|---|---|---|
| `pt-{stage}-aps1-core` | Users, orgs, memberships, invites, sites, configs, webhook endpoints, support grants | small, read-heavy | life of the account | personal | dashboard |
| `pt-{stage}-aps1-receipts` | Consent ledger: hash-chained receipts, chain heads, daily anchors | very high, write-heavy | per plan (90 days to 10 years) + optional archive | personal (pseudonymous) | public consent API only |
| `pt-{stage}-aps1-telemetry` | Pageview counters, leak reports, webhook delivery logs | high | 90 days (counters 25 months) | confidential | public API + dashboard |
| `pt-{stage}-aps1-audit` | Organization audit trail and staff audit trail | moderate | 7 years | confidential | dashboard, **append-only** |
| `pt-{stage}-aps1-leads` | Contact-sales submissions | low | 24 months | personal (prospects) | contact form; staff read |
| `pt-{stage}-aps1-ephemeral` | Sessions, sign-in lockouts, rate-limit windows, webhook idempotency keys | high churn | minutes to 30 days | confidential | both |

All six tables share:
- **Billing:** on-demand, so an idle table costs nothing.
- **Encryption:** the customer-managed KMS key `alias/pt-{stage}-aps1-data`.
- **Recovery:** point-in-time recovery.
- **Protection:** deletion protection, and `RETAIN` on stack delete.
- **TTL:** on `expiresAt`.

**Security by table:**
- **Two IAM roles** (see §8):
  - The **ingest** role is used by public endpoints. It can append receipts, write counters and leaks, keep rate
    limits and submit leads.
  - It **can't read leads**, can't write accounts, and can't touch the audit trail.
- **Audit is append-only:** both roles are explicitly denied `UpdateItem`, `DeleteItem` and `BatchWriteItem` on the
  audit table, so its history can't be rewritten from the app.
- **Leads are staff-only to read:**
  - The ingest role may only `PutItem` a lead, and `Query` the email index for duplicate checks.
  - The staff console reads the inbox through the runtime role, gated by a staff permission.
- **Rate limits are shared:** they live in `ephemeral` as atomic counters with TTL. In-memory limits don't hold
  across Vercel's many short-lived instances.

**Cost and performance:**
- **Narrow index projections.** GSIs project only what their queries need. The receipts visitor index is
  `KEYS_ONLY`, followed by a batch get, so receipt writes stay cheap.
- **No Scans:** staff console lists use `core` GSI2.

### `core` access patterns

| Pattern | Key |
|---|---|
| User by id / by email | `USER#id` · `PROFILE`; GSI1 `EMAIL#email` |
| User's orgs | GSI1 `USER#id` → `ORG#id` (membership rows) |
| Org profile, members, invites, sites | `ORG#id` · `PROFILE` / `MEMBER#userId` / `INVITE#id` / `PROP#id` |
| Site by public key | GSI1 `SITEKEY#key` |
| **Staff console lists** (orgs, users, newest first, paginated) | **GSI2** `TYPE#ORG` / `TYPE#USER` · `createdAt#id` |
| Support access grants | `ORG#id` · `GRANT#id` (TTL = expiry) |

GSI2 replaces the table **Scans** the staff console uses today (`listOrgs`, `listUsers`). Those stay fast and cheap however
many customers there are.

### `leads` access patterns

| Pattern | Key |
|---|---|
| Submit a lead | `LEAD#id` · `PROFILE` (TTL 24 months) |
| Sales inbox by status, newest first | GSI1 `STATUS#new` · `createdAt#id` |
| Earlier submissions from one person (dedupe) | GSI2 `EMAIL#email` · `createdAt` |
| Status changes and notes | `LEAD#id` · `NOTE#ts` |

### `audit` access patterns

| Pattern | Key |
|---|---|
| Org audit, newest first | `ORG#id` · `TS#iso#id` |
| Staff audit, by month | `PLATFORM#yyyy-mm` · `TS#iso#id` |
| Everything one person did (access reviews) | GSI1 `ACTOR#userId` · `TS#iso#id` |

### `ephemeral` and `telemetry` access patterns

| Pattern | Key |
|---|---|
| Session | `SESSION#id` (TTL = expiry) |
| Rate-limit window | `RATE#name#key#window` (atomic `ADD`, TTL = window end) |
| Sign-in lockout | `LOCK#userId` (TTL 15 min) |
| Stripe webhook idempotency | `STRIPE#eventId` (TTL 30 days) |
| Pageview counters | `PROP#id` · `DAY#yyyy-mm-dd` (atomic `ADD`) |
| Leak reports | `PROP#id` · `LEAK#ts#id` (TTL 90 days) |
| Webhook deliveries | `PROP#id` · `WHD#ts#id` (TTL 30 days) |

### `receipts` access patterns

| Pattern | Key |
|---|---|
| Append a receipt, advancing the hash chain | `PROP#id` · `RCPT#seq` + `PROP#id` · `CHAIN#HEAD`, in one conditional transaction |
| Log page / export | `PROP#id`, SK range on `RCPT#` |
| Visitor's own receipts (data-subject request) | GSI1 `PROP#id#V#visitorId` · `RCPT#seq` |
| Daily anchor (public) | `ANCHOR#yyyy-mm-dd` · `PROP#id` |

**Known scaling limit, with a fix ready:**
- **The limit:** every receipt for a site advances one chain-head item, so each site's writes are serialized. That's fine
  into the tens of decisions per second per site.
- **The fix, for very large sites:** shard the chain into N lanes (`CHAIN#HEAD#0..N-1`, picked by visitor hash). Each lane
  is its own verifiable chain, and the daily anchor commits to every lane's head. This can be switched on per site later,
  without migrating data.

## 7. Identity, organizations and roles

There are three layers. Keeping them separate is what makes "our company and team" versus "customers and their teams" safe.

### 7.1 Who you are: two Cognito user pools

Customers and Plain Theory staff sign in through **separate pools**. Nothing a customer can do (sign up, reset a
password, change their email) can create or reach a staff identity.

| Setting | Customers (`pt-prod-aps1-customers`) | Staff (`pt-prod-aps1-staff`) |
|---|---|---|
| Sign-up | Self sign-up; the email is confirmed with a 6-digit code | **Disabled.** A superadmin invites with `AdminCreateUser`; Cognito emails a temporary password (valid 1 day) from its default sender |
| Sign-in | `USER_PASSWORD_AUTH`, server-side, at `/login`; then the app's own TOTP if the user turned it on | `USER_PASSWORD_AUTH`, server-side, at `/admin/login`. First sign-in: `NEW_PASSWORD_REQUIRED`, then `MFA_SETUP` (authenticator app). Every sign-in after: `SOFTWARE_TOKEN_MFA` |
| Two-factor | Optional, run by the app (an org can require it) | **Required, TOTP only, enforced by Cognito** |
| Password | 12+ characters with a lowercase letter, a number and a symbol | Same |
| Recovery | Forgot password by emailed code; on reset, every session is revoked | **None.** A superadmin resets the password (a new temporary password by email; the authenticator stays) |
| App client | No secret, token revocation on | No secret, token revocation on, refresh 8 h, auth session 3 min |
| Roles | Not in Cognito: per-organization membership rows in the `core` table | The `platform-superadmin`, `platform-support`, `platform-billing` and `platform-analyst` groups **are** the roles |

**Why two pools:**
- **Staff status can't be self-granted or reached from the customer side.** The staff pool has no sign-up, and only a
  superadmin (in the console, audited) or an AWS administrator (`npm run staff:invite`) can create an account or change
  its group.
- **The console's rules are the pool's rules.** TOTP is enforced by Cognito for every staff sign-in, not by app code
  that could be bypassed or misconfigured.
- **Groups are the source of truth.** There's no `platformRole` copy in the data store to drift from Cognito, and no
  environment-variable bootstrap: the first superadmin is invited with `npm run staff:invite`.
- **Someone who's both** (for example a founder testing their own product) has two logins, which keeps the console out
  of reach of a compromised customer account.
- **Later:** if staff move to company SSO (Google Workspace or Microsoft Entra), federate it into the staff pool.

The app keeps its own server-side session after either Cognito sign-in (the cookie references a `SESSION#` record in the
`ephemeral` table), and Cognito refresh tokens are revoked straight after sign-in. For staff, the ID token is verified
against the staff pool's JWKS (issuer, audience = the staff client, `token_use` = `id`, expiry) and the role is read from
`cognito:groups` (highest group wins; no group, no sign-in). Staff sessions are separate from customer sessions:
- their own cookie (`pt_staff`, path `/admin`), with records of kind `staff` keyed `staff:<sub>` that hold the staff
  identity and role;
- a 1-hour idle timeout and an 8-hour absolute lifetime;
- a customer session never opens `/admin`, and a staff session never opens `/app`;
- changing someone's role, resetting their password, disabling or removing them ends their console sessions at once.

### 7.2 What our team can do: platform roles (staff pool `platform-*` groups)

| Permission | Superadmin | Support | Billing | Analyst |
|---|:-:|:-:|:-:|:-:|
| Overview metrics, plan mix, signups | ✓ | ✓ | ✓ | ✓ |
| Org and user lists, org metadata (name, plan, region, members, sites) | ✓ | ✓ | ✓ | ✓ |
| Customer audit log and session detail | ✓ | ✓ | | |
| Unlock an account, sign a user out everywhere | ✓ | ✓ | | |
| Contact-request inbox (read) | ✓ | ✓ | | ✓ |
| Contact-request status changes | ✓ | ✓ | | |
| **Request support access** to an org's consent records (time-boxed, see 7.4) | ✓ | ✓ | | |
| Change plan / comp, refunds via Stripe portal | ✓ | | ✓ | |
| Suspend or lift suspension | ✓ | | | |
| Invite, change, reset, disable and remove staff (`/admin/staff`) | ✓ | | | |
| Break-glass access (immediate, alerts every superadmin) | ✓ | | | |

Rules:
- Nobody changes, resets, disables or removes their own staff account.
- The last enabled superadmin can't be demoted, disabled or removed.
- There's no environment-variable bootstrap: the first superadmin is invited with
  `npm run staff:invite -- <email> "<Full Name>" superadmin` using AWS administrator credentials.
- Every staff action is written to the platform audit trail, which is hash-chained like the receipts.
- Staff **reads** of customer detail are logged too, not just changes.

### 7.3 What a customer's team can do: organization roles (DynamoDB memberships)

A person can belong to many organizations, with a different role in each. Agencies use one organization per client. The
role lives on the membership row (`ORG#id` · `MEMBER#userId`), never in Cognito.

| Permission | Owner | Admin | Editor (new) | Auditor (new) | Viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| View sites, analytics, banner | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit banners, regions, languages, trackers; publish | ✓ | ✓ | ✓ | | |
| Add or delete sites | ✓ | ✓ | | | |
| Export consent logs and Evidence Packs | ✓ | ✓ | | ✓ | ✓ |
| Read audit trail and access reviews | ✓ | ✓ | | ✓ | |
| Invite or remove members, change roles | ✓ | ✓ (not Owners) | | | |
| Org security policy (require MFA, SSO) | ✓ | | | | |
| Billing and plan | ✓ | | | | |
| Approve support access requests | ✓ | ✓ | | | |
| Delete the organization, transfer ownership | ✓ | | | | |

- **Editor** is for marketers and developers who change banners but shouldn't manage people.
- **Auditor** is for a DPO or an external auditor: read-only, with exports and the audit trail.
- **Viewer** stays read-only.
- **Always at least one Owner.** Ownership transfer is explicit.
- **Plans limit seats, not roles.** Custom roles can come later for Enterprise.

### 7.4 How our team reaches a customer's data: support access grants

Staff can see **metadata** (org name, plan, members, sites, health). They can't read a customer's **consent records,
visitor data or exports** without a grant:

1. **Request.** Support picks the org, a scope (`read:logs`, `read:config`) and a reason (ticket number). The duration
   defaults to 1 hour and is at most 24 hours.
2. **Approve.** An org Owner or Admin approves it in the dashboard. Enterprise customers can turn on auto-approve for
   named support staff.
3. **Use.** The grant is stored as `ORG#id` · `GRANT#id` with a TTL. Every page view under the grant is logged to
   **both** audit trails: ours, and the customer's own (they see "Plain Theory support viewed consent logs, ticket #123").
4. **Expire.** When the TTL lapses, access stops with no cleanup job.
5. **Break-glass.** A superadmin can open an immediate grant without approval. It notifies the org's owners and every
   superadmin, and appears in the customer's log as a break-glass entry.

This is the trust story enterprise buyers and SOC 2 auditors look for: least privilege, customer consent, full traceability.

### 7.5 Where it's enforced

- **One authorization function per layer:**
  - `requireStaff(permission)` for `/admin` pages and actions.
  - `requireOrg(orgId, permission)` for `/app` pages and actions.
  - `requireGrant(orgId, scope)` whenever staff touch consent data.
  - Every server action and API route calls one of them. The UI hides what you can't do, but only the server decides.
- **Public consent API:** authenticated by site key plus origin check. Its IAM permissions cover the `receipts` table and
  reading configs, never `core` writes.
- **Org suspension:** enforced in `requireOrg`, as built.

## 8. Vercel and AWS

- **OIDC trust:**
  - Create the IAM OIDC provider `oidc.vercel.com/<team-slug>` (team issuer mode).
  - Each environment gets a role whose trust policy pins:
    - `aud = https://vercel.com/<team-slug>`
    - `sub = owner:<team-slug>:project:theplaintheory:environment:production`
  - Preview deployments assume the **staging** role, so they can never touch prod data.
- **SDK:** `@vercel/oidc-aws-credentials-provider` passes `awsCredentialsProvider({ roleArn })` to every AWS SDK client
  (DynamoDB, Cognito, S3, CloudFront, SES).
- **Least-privilege runtime policy (`pt-prod-vercel-runtime`):**
  - `core`: read and write.
  - `receipts`: read and write.
  - The config bucket: `s3:PutObject` on `c/*`.
  - `cloudfront:CreateInvalidation` on the one distribution.
  - Cognito admin APIs on the two pools (for staff invites and group changes).
  - `ses:SendEmail` from the verified identity.
  - KMS encrypt and decrypt via the data key.
- **Regions:** set `"regions": ["bom1"]` in `vercel.json`, which is co-located with ap-south-1.
- **Secrets:**
  - App secrets (`SESSION_SECRET`, Stripe keys, `IP_HASH_SALT`, `INTERNAL_CRON_SECRET`) live in Vercel's encrypted env
    vars, per environment.
  - AWS has **no** long-lived keys.

## 9. Other services

- **SES:** domain identity with DKIM and a custom MAIL FROM. Cognito sends through SES, which lifts Cognito's default
  limit of 50 emails a day. Invites, alerts and support-grant notices also go through SES.
- **CloudFront + S3:** stays as built (OAC, Brotli, HTTP/3, the geo-header function). Configs are cached for 60 seconds.
- **Observability:**
  - CloudWatch alarms for DynamoDB throttles and system errors, Cognito sign-in failure spikes, CloudFront 5xx rate, and
    SES bounce and complaint rate.
  - Vercel's logs and Web Analytics cover the app side.
- **Backups:** point-in-time recovery on both tables. AWS Backup copies `core` daily to ap-south-2 (Hyderabad) for disaster
  recovery inside India.
- **Archive:** optional. Receipts stream to S3 with Object Lock for retention beyond the DynamoDB TTL.

## 10. What changes in the code

| Area | Change |
|---|---|
| `infra/` | Rename stacks and resources to the scheme above; add the tag Aspect; split tables; add the user pool and `platform-*` groups; add the app IAM user and the optional Vercel OIDC roles; add SES; add alarms and budgets; replace the Amplify/ECS role |
| `src/lib/aws.ts` (new) | One place that builds AWS SDK clients with Vercel OIDC credentials (local dev falls back to the default chain) |
| `src/lib/store/dynamo.ts` | Two table names; GSI2 for paginated staff lists (no Scans); receipts in their own table; support grants |
| `src/lib/auth/*` | Customer sign-in on the customers pool; staff sign-in at `/admin/login` on the staff pool (`staff-cognito.ts`), separate staff sessions (`staff.ts`), platform roles from the staff pool's groups (`User.platformRole` and `PLATFORM_SUPERADMINS` removed); `requireGrant` |
| `src/lib/auth/rbac.ts` | Add the Editor and Auditor roles and the permission matrix above |
| `/app/team`, `/admin` | Role picker with the new roles; support-access request and approval screens; break-glass flow |
| Vercel | `vercel.json` regions `bom1`; env vars per environment; Preview deployments wired to staging |

## 11. Rollout

1. **Decisions** (below). If you choose dedicated accounts, create `plaintheory-prod` and `plaintheory-nonprod` and
   bootstrap CDK in each.
2. **Infra on staging:** run `cdk diff`, review it, then deploy `PlainTheory-Staging-*`. Verify SES, both pools and the
   OIDC role from a Vercel Preview deployment.
3. **App changes:** behind the existing drivers (`STORE_DRIVER`, `AUTH_DRIVER`), so local dev keeps working with no AWS.
   Tests come first for the role matrices and grant expiry.
4. **Production:** deploy `PlainTheory-Prod-*`, set the Vercel production env vars, invite the first superadmin with
   `npm run staff:invite`, and smoke-test sign-up, onboarding, publish and the consent API.
5. **Then:** enterprise SSO, IdP federation for staff, and the receipt archive.

## Decisions

Recorded 2026-10-07.

| # | Decision | Choice |
|---|---|---|
| 1 | AWS accounts | **The existing account** (417915984158), isolated by `pt-*` naming, tags and least-privilege IAM. Dedicated accounts remain the recommended next step |
| 2 | Primary region | **ap-south-1 (Mumbai)** for data; Vercel functions in `bom1` |
| 3 | Staff identity | **Two Cognito pools.** Customers in one; staff in an invite-only pool with Cognito-enforced TOTP, whose `platform-*` groups are the staff roles. Separate staff sessions and cookie; the first superadmin is bootstrapped with `npm run staff:invite` |
| 4 | Customer roles | **Add Editor and Auditor** alongside Owner, Admin and Viewer |

| 5 | Domain | **www.theplaintheory.in** (DNS at GoDaddy) |
| 6 | Billing | **Stripe is the source of truth for prices** (lookup keys `pt_<plan>_<interval>`, synced from `plans.ts` by `npm run stripe:sync`) |

Still open:
- Add the SES DKIM and MAIL FROM records at GoDaddy, then request SES production access.
- A custom CDN domain (`cdn.theplaintheory.in`) needs an ACM certificate in us-east-1.
