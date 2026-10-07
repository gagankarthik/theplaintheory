import "server-only";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * One place that builds AWS SDK clients.
 *
 * Credentials: Vercel's function runtime sets the standard AWS_* variables to its own values (which
 * grant nothing), so on Vercel the app's keys live in PT_AWS_ACCESS_KEY_ID / PT_AWS_SECRET_ACCESS_KEY
 * and are passed explicitly. Without them (local development) the SDK's default chain is used:
 * AWS_* env vars, the shared ~/.aws profile, and so on.
 *
 * Region: PT_AWS_REGION, else AWS_REGION, else ap-south-1 (where the data lives).
 */
export const awsRegion = process.env.PT_AWS_REGION || process.env.AWS_REGION || "ap-south-1";

const credentials =
  process.env.PT_AWS_ACCESS_KEY_ID && process.env.PT_AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.PT_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.PT_AWS_SECRET_ACCESS_KEY }
    : undefined;

const config = { region: awsRegion, credentials, maxAttempts: 3 };

let ddb: DynamoDBDocumentClient | undefined;
/** DynamoDB document client: plain JS values in and out, undefined attributes dropped. */
export function dynamo() {
  ddb ??= DynamoDBDocumentClient.from(new DynamoDBClient(config), {
    marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
  });
  return ddb;
}

let cognito: CognitoIdentityProviderClient | undefined;
export function cognitoClient() {
  cognito ??= new CognitoIdentityProviderClient({ ...config, region: process.env.COGNITO_REGION || awsRegion });
  return cognito;
}

let s3: S3Client | undefined;
export function s3Client() {
  s3 ??= new S3Client(config);
  return s3;
}

let ses: SESv2Client | undefined;
export function sesClient() {
  ses ??= new SESv2Client(config);
  return ses;
}

let cloudfront: CloudFrontClient | undefined;
/** CloudFront is a global service; its API lives in us-east-1. */
export function cloudfrontClient() {
  cloudfront ??= new CloudFrontClient({ ...config, region: "us-east-1" });
  return cloudfront;
}

/** The six tables (docs/architecture/platform-architecture.md §6), named per stage by the CDK Data stack. */
export const TABLES = {
  core: process.env.DYNAMO_TABLE_CORE || "pt-prod-aps1-core",
  receipts: process.env.DYNAMO_TABLE_RECEIPTS || "pt-prod-aps1-receipts",
  telemetry: process.env.DYNAMO_TABLE_TELEMETRY || "pt-prod-aps1-telemetry",
  audit: process.env.DYNAMO_TABLE_AUDIT || "pt-prod-aps1-audit",
  leads: process.env.DYNAMO_TABLE_LEADS || "pt-prod-aps1-leads",
  ephemeral: process.env.DYNAMO_TABLE_EPHEMERAL || "pt-prod-aps1-ephemeral",
} as const;
