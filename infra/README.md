# The Plain Theory: AWS infrastructure (CDK v2)

The Next.js app runs anywhere. This CDK app provisions the AWS pieces it switches to in production:

| Stack | What it creates | Feeds env var |
|---|---|---|
| `PlainTheory-<stage>-Data` | DynamoDB single table (on-demand, PITR, KMS CMK, TTL `expiresAt`, `GSI1`), optional receipt archive | `DYNAMO_TABLE`, `AWS_REGION` |
| `PlainTheory-<stage>-Delivery` | Private S3 bucket + CloudFront (OAC, HTTP/2+3, Brotli), geo-header CloudFront Function, SDK upload | `CONFIG_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `NEXT_PUBLIC_CDN_URL` |
| `PlainTheory-<stage>-Auth` | Cognito user pool (email sign-in, 12+ char passwords, optional TOTP MFA) and app client | `COGNITO_CLIENT_ID`, `COGNITO_REGION` |
| `PlainTheory-<stage>-App` | Least-privilege IAM role for the app runtime (Amplify compute role or ECS task role) | — |

## Deploy

```bash
# at the repo root: build the SDK the Delivery stack uploads
npm run sdk:build

cd infra
npm install
npx cdk bootstrap aws://<account>/ap-south-1
npx cdk deploy --all \
  -c stage=prod \
  -c dataRegion=ap-south-1 \
  -c cdnDomain=cdn.theplaintheory.com \
  -c certificateArn=arn:aws:acm:us-east-1:<account>:certificate/<id> \
  -c archive=true
```

`npx cdk synth` works without credentials and is a good check before a deploy.

### Data residency (DPDPA)

Every stack deploys to `dataRegion`. For India-pinned tenants, use `ap-south-1` (Mumbai) or `ap-south-2` (Hyderabad).
For EU-pinned tenants, deploy a second stage (`-c stage=eu -c dataRegion=eu-central-1`) and point those
tenants' app instance at it. CloudFront is global, but it only serves the public banner config and the SDK.
No personal data passes through it.

## Single-table design

```
PK              SK                      GSI1PK            GSI1SK
USER#<id>       PROFILE                 EMAIL#<email>     USER
ORG#<id>        PROFILE
ORG#<id>        MEMBER#<userId>         USER#<userId>     ORG#<id>
ORG#<id>        INVITE#<id>             EMAIL#<email>     INVITE#<id>
ORG#<id>        PROP#<id>               PROP#<id>         PROFILE
PROP#<id>       PROFILE (pointer)       SITEKEY#<key>     PROP
PROP#<id>       CHAIN#HEAD
PROP#<id>       RCPT#<seq, 12 digits>
PROP#<id>       DAY#<yyyy-mm-dd>
```

- **Receipts** are append-only. `appendReceipt` writes `RCPT#<seq>` and advances `CHAIN#HEAD` in one
  conditional transaction, so two concurrent writers can never fork the hash chain.
- **Retention**: set `expiresAt` (epoch seconds) on receipts according to the plan's retention. DynamoDB TTL deletes
  them, and the archive (below) keeps the long-term copy.
- **Visitor lookups** (`GET /api/v1/receipts/:visitorId`) scan a property's receipts today. At scale, add
  `GSI2 (GSI2PK = PROP#<id>#V#<visitorId>, GSI2SK = RCPT#<seq>)`.

## Receipt archive (`-c archive=true`)

DynamoDB → Kinesis Data Stream → Firehose → S3 (`receipts/dt=YYYY-MM-DD/`, GZIP, KMS) → Glue table
`plain_theory_<stage>.receipt_stream` with partition projection, ready for Athena. The bucket has Object Lock
(governance, 2 years), so exported audit evidence can't be silently rewritten.

```sql
SELECT dynamodb.NewImage['action'], count(*)
FROM plain_theory_prod.receipt_stream
WHERE dt BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY 1;
```

## Edge geo headers

`functions/geo-headers.js` runs on viewer-response for `c/*`. It copies `CloudFront-Viewer-Country` and
`-Region` into `x-plain-country` / `x-plain-region` and exposes them over CORS. The SDK reads them to choose
GDPR, CCPA, DPDPA or the default notice. One cached object serves every country, so there's no per-country
cache fragmentation.

## Hosting the dashboard

Create an Amplify Hosting app from the repository (Next.js SSR is detected automatically), attach the
`plain-theory-<stage>-app` role as the compute role, and set:

```
STORE_DRIVER=dynamodb          DYNAMO_TABLE=<DataStack output>
AUTH_DRIVER=cognito            COGNITO_CLIENT_ID=<AuthStack output>   COGNITO_REGION=<region>
PUBLISH_DRIVER=s3              CONFIG_BUCKET=<DeliveryStack output>   CLOUDFRONT_DISTRIBUTION_ID=<output>
NEXT_PUBLIC_CDN_URL=<CdnUrl>   AWS_REGION=<dataRegion>
SESSION_SECRET=<32+ random bytes>   IP_HASH_SALT=<random>   NEXT_PUBLIC_SITE_URL=https://app.theplaintheory.com
```

ECS Fargate works the same way: use the role as the task role and pass the same environment.
