# The Plain Theory: AWS infrastructure (CDK v2)

The full design (accounts, naming, tags, tables, identity, roles) is in
[`docs/architecture/platform-architecture.md`](../docs/architecture/platform-architecture.md). This file covers deployment.

The app runs on **Vercel** (functions in `bom1`, beside ap-south-1). It reaches AWS through **OIDC federation**,
so there are no access keys. One deploy creates one stage (`prod`, `staging` or `dev`) in one account.

| Stack | Creates | Env vars it feeds |
|---|---|---|
| `PlainTheory-{Stage}-Data` | KMS key and six DynamoDB tables: `core`, `receipts`, `telemetry`, `audit`, `leads`, `ephemeral`. Optional receipt archive (Kinesis → Firehose → S3 Object Lock → Athena) | `DYNAMO_TABLE_*`, `AWS_REGION` |
| `PlainTheory-{Stage}-Identity` | Cognito `customers` pool (self sign-up, optional TOTP) and `staff` pool (invite-only, TOTP required, groups `platform-*`) | `COGNITO_CUSTOMER_*`, `COGNITO_STAFF_*`, `COGNITO_REGION` |
| `PlainTheory-{Stage}-Delivery` | Private S3 config bucket and CloudFront (OAC, HTTP/3, Brotli, geo headers); uploads the SDK | `CONFIG_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `NEXT_PUBLIC_CDN_URL` |
| `PlainTheory-{Stage}-Mail` | SES domain identity (DKIM, custom MAIL FROM), configuration set | `MAIL_FROM` |
| `PlainTheory-{Stage}-Access` | Vercel OIDC provider; roles `pt-{stage}-vercel-runtime` (dashboard, staff console) and `pt-{stage}-vercel-ingest` (public endpoints) | `AWS_ROLE_ARN`, `AWS_INGEST_ROLE_ARN` |
| `PlainTheory-{Stage}-Observability` | SNS alerts topic, DynamoDB throttle and error alarms, monthly budget on the stage tag | none |

Every resource is named `pt-{stage}-{regionCode}-{component}` and carries the tags `Project`, `Environment`,
`Component`, `Owner`, `CostCenter`, `DataClassification`, `Compliance`, `ManagedBy` and `Repository`. Synth fails if
any taggable resource is missing one.

## Deploy

Use the dedicated accounts: `plaintheory-nonprod` for `staging`/`dev` and `plaintheory-prod` for `prod`.

```bash
npm run sdk:build            # at the repo root: the Delivery stack uploads public/sdk

cd infra && npm install
npx cdk bootstrap aws://<account>/ap-south-1
npx cdk diff  -c stage=staging -c vercelTeam=<team-slug> -c sesDomain=theplaintheory.in -c alertEmail=<you>
npx cdk deploy --all -c stage=staging -c vercelTeam=<team-slug> -c sesDomain=theplaintheory.in -c alertEmail=<you>
```

| Context | Meaning |
|---|---|
| `stage` | `prod`, `staging` or `dev` |
| `dataRegion` | default `ap-south-1` |
| `vercelTeam`, `vercelProject` | OIDC trust. Prod trusts the `production` environment, staging trusts `preview`, dev trusts `development` |
| `oidcProviderArn` | Reuse the account's Vercel OIDC provider if another stage already created it |
| `sesDomain`, `sesVerified` | Create the SES identity; once DNS verifies, redeploy with `-c sesVerified=true` so Cognito sends through SES |
| `cdnDomain`, `certificateArn` | Custom CDN domain; the ACM certificate must be in us-east-1 |
| `alertEmail`, `monthlyBudgetUsd` | Alarm and budget recipients; budget defaults to 200 (prod) or 50 |
| `archive` | `true` streams receipts to the S3 archive |

`npx cdk synth` needs no AWS calls, which makes it a good check before any deploy.

After the first deploy:
1. Add the DKIM and MAIL FROM records from the Mail stack outputs to DNS.
2. Request SES production access for the account.
3. Activate the `Project`, `Environment` and `Component` cost allocation tags in Billing.
4. Invite the first staff member: `npm run staff:invite -- you@theplaintheory.in "Your Name" superadmin` (creates them in the staff pool, in `platform-superadmin`; Cognito emails a temporary password, and the first sign-in at `/admin/login` sets a new password and an authenticator app).

## Vercel

Set the stack outputs as env vars per Vercel environment (Production → prod outputs; Preview → staging outputs),
plus `vercel.json` `"regions": ["bom1"]`. App secrets (`SESSION_SECRET`, `IP_HASH_SALT`, `INTERNAL_CRON_SECRET`,
Stripe keys) stay in Vercel's encrypted env vars. The app builds its AWS clients with
`awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN })` from `@vercel/oidc-aws-credentials-provider`.

## Edge geo headers

`functions/geo-headers.js` runs on viewer-response for `c/*`. It copies `CloudFront-Viewer-Country` and `-Region`
into `x-plain-country` and `x-plain-region`, and exposes them over CORS. The SDK reads them to choose the GDPR,
CCPA, DPDPA or default notice from one cached object.
