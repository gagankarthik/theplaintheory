import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import * as kms from "aws-cdk-lib/aws-kms";
import type { Construct } from "constructs";
import { ReceiptArchive } from "./archive";

export interface DataStackProps extends StackProps {
  stage: string;
  /** Stream receipts to S3 for Athena queries and long-term retention */
  archive: boolean;
}

/**
 * Tenants, configs, memberships and consent receipts in one DynamoDB table.
 * Deploy this stack in the region where personal data must stay
 * (ap-south-1 Mumbai / ap-south-2 Hyderabad for DPDPA, eu-central-1 for GDPR-sensitive tenants).
 */
export class DataStack extends Stack {
  readonly table: dynamodb.Table;
  readonly key: kms.Key;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.key = new kms.Key(this, "DataKey", {
      alias: `alias/plain-theory-${props.stage}-data`,
      enableKeyRotation: true,
      description: "Encrypts consent receipts and tenant data at rest (AES-256)",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const stream = props.archive
      ? new kinesis.Stream(this, "ReceiptStream", {
          streamMode: kinesis.StreamMode.ON_DEMAND,
          encryption: kinesis.StreamEncryption.KMS,
          encryptionKey: this.key,
          retentionPeriod: Duration.hours(48),
        })
      : undefined;

    this.table = new dynamodb.Table(this, "Table", {
      tableName: `plain-theory-${props.stage}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: "expiresAt",
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      kinesisStream: stream,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    if (stream) new ReceiptArchive(this, "Archive", { stream, key: this.key, stage: props.stage });

    new CfnOutput(this, "TableName", { value: this.table.tableName, description: "DYNAMO_TABLE" });
    new CfnOutput(this, "DataRegion", { value: this.region, description: "AWS_REGION for the app" });
  }
}
