import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import * as kms from "aws-cdk-lib/aws-kms";
import type { Construct } from "constructs";
import { ReceiptArchive } from "./archive";
import type { Naming } from "./naming";
import { type DataClassification, tagComponent } from "./tags";

export interface DataStackProps extends StackProps {
  naming: Naming;
  /** Stream receipts to S3 (Object Lock) for retention beyond the DynamoDB TTL */
  archive: boolean;
}

/** The six tables, one per product domain (docs/architecture/platform-architecture.md §6). */
export type TableId = "core" | "receipts" | "telemetry" | "audit" | "leads" | "ephemeral";

interface TableSpec {
  id: TableId;
  description: string;
  classification: DataClassification;
  gsis?: { name: "GSI1" | "GSI2"; projection: dynamodb.ProjectionType; include?: string[] }[];
}

const SPECS: TableSpec[] = [
  {
    id: "core",
    description: "Accounts and tenancy: users, organizations, memberships, invites, sites, configs, webhook endpoints, support grants",
    classification: "personal",
    gsis: [
      // Lookups: EMAIL#<email>, SITEKEY#<key>, USER#<id> -> ORG#<id>
      { name: "GSI1", projection: dynamodb.ProjectionType.ALL },
      // Staff console lists, newest first: TYPE#ORG / TYPE#USER -> <createdAt>#<id>
      { name: "GSI2", projection: dynamodb.ProjectionType.INCLUDE, include: ["name", "email", "plan", "kind", "dataRegion", "suspendedAt", "createdAt"] },
    ],
  },
  {
    id: "receipts",
    description: "Consent ledger: hash-chained receipts, chain heads and daily anchors",
    classification: "personal",
    // Data-subject lookups (PROP#<id>#V#<visitorId> -> RCPT#<seq>) are rare: keys only, then a batch get.
    gsis: [{ name: "GSI1", projection: dynamodb.ProjectionType.KEYS_ONLY }],
  },
  {
    id: "telemetry",
    description: "Operational signals: pageview counters, leak reports, webhook delivery logs (short TTL)",
    classification: "confidential",
  },
  {
    id: "audit",
    description: "Append-only audit trails: organization events and Plain Theory staff actions",
    classification: "confidential",
    // Access reviews: everything one person did. ACTOR#<userId> -> <ts>#<id>
    gsis: [{ name: "GSI1", projection: dynamodb.ProjectionType.ALL }],
  },
  {
    id: "leads",
    description: "Contact-sales submissions from prospects (24-month retention, staff-only)",
    classification: "personal",
    gsis: [
      // Sales inbox by status, newest first: STATUS#new -> <createdAt>#<id>
      { name: "GSI1", projection: dynamodb.ProjectionType.ALL },
      // Prior submissions from one person: EMAIL#<email> -> <createdAt>
      { name: "GSI2", projection: dynamodb.ProjectionType.KEYS_ONLY },
    ],
  },
  {
    id: "ephemeral",
    description: "Short-lived security state: sessions, sign-in lockouts, rate-limit windows, webhook idempotency keys",
    classification: "confidential",
  },
];

/**
 * Six DynamoDB tables, all encrypted with one customer-managed key, point-in-time recovery,
 * deletion protection and TTL on `expiresAt`. On-demand billing: an idle table costs nothing.
 * Splitting by domain lets each table get its own retention, IAM (see access-stack.ts) and scaling.
 */
export class DataStack extends Stack {
  readonly key: kms.Key;
  readonly tables: Record<TableId, dynamodb.Table>;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { naming } = props;
    tagComponent(this, "data", "personal");

    this.key = new kms.Key(this, "DataKey", {
      alias: naming.alias("data"),
      enableKeyRotation: true,
      description: "Encrypts Plain Theory tables, streams and archives at rest",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const archiveStream = props.archive
      ? new kinesis.Stream(this, "ReceiptStream", {
          streamName: naming.name("receipts-stream"),
          streamMode: kinesis.StreamMode.ON_DEMAND,
          encryption: kinesis.StreamEncryption.KMS,
          encryptionKey: this.key,
          retentionPeriod: Duration.hours(48),
        })
      : undefined;

    const tables = {} as Record<TableId, dynamodb.Table>;
    for (const spec of SPECS) {
      const table = new dynamodb.Table(this, `${spec.id[0].toUpperCase()}${spec.id.slice(1)}Table`, {
        tableName: naming.name(spec.id),
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
        encryptionKey: this.key,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        timeToLiveAttribute: "expiresAt",
        deletionProtection: true,
        removalPolicy: RemovalPolicy.RETAIN,
        kinesisStream: spec.id === "receipts" ? archiveStream : undefined,
      });
      for (const g of spec.gsis ?? []) {
        table.addGlobalSecondaryIndex({
          indexName: g.name,
          partitionKey: { name: `${g.name}PK`, type: dynamodb.AttributeType.STRING },
          sortKey: { name: `${g.name}SK`, type: dynamodb.AttributeType.STRING },
          projectionType: g.projection,
          nonKeyAttributes: g.include,
        });
      }
      tagComponent(table, "data", spec.classification);
      new CfnOutput(this, `${spec.id}TableName`, { value: table.tableName, description: `DYNAMO_TABLE_${spec.id.toUpperCase()}: ${spec.description}` });
      tables[spec.id] = table;
    }
    this.tables = tables;

    if (archiveStream) new ReceiptArchive(this, "Archive", { stream: archiveStream, key: this.key, naming });

    new CfnOutput(this, "DataRegion", { value: this.region, description: "AWS_REGION for the app" });
  }
}
