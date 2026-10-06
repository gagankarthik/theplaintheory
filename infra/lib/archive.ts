import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as firehose from "aws-cdk-lib/aws-kinesisfirehose";
import * as glue from "aws-cdk-lib/aws-glue";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as kinesis from "aws-cdk-lib/aws-kinesis";
import type * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

/**
 * DynamoDB change stream -> Kinesis -> Firehose -> S3 (partitioned by day) -> Glue table for Athena.
 * Keeps an append-only copy of every receipt for cheap multi-year audit queries.
 * The bucket uses Object Lock (governance mode) so archived receipts can't be silently overwritten.
 */
export class ReceiptArchive extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: { stream: kinesis.Stream; key: kms.Key; stage: string }) {
    super(scope, id);
    const stack = Stack.of(this);

    this.bucket = new s3.Bucket(this, "Bucket", {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      objectLockEnabled: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.governance(Duration.days(365 * 2)),
      lifecycleRules: [{ transitions: [{ storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL, transitionAfter: Duration.days(90) }] }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const role = new iam.Role(this, "FirehoseRole", { assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com") });
    props.stream.grantRead(role);
    this.bucket.grantReadWrite(role);
    props.key.grantEncryptDecrypt(role);

    new firehose.CfnDeliveryStream(this, "Delivery", {
      deliveryStreamType: "KinesisStreamAsSource",
      kinesisStreamSourceConfiguration: { kinesisStreamArn: props.stream.streamArn, roleArn: role.roleArn },
      extendedS3DestinationConfiguration: {
        bucketArn: this.bucket.bucketArn,
        roleArn: role.roleArn,
        prefix: "receipts/dt=!{timestamp:yyyy-MM-dd}/",
        errorOutputPrefix: "errors/!{firehose:error-output-type}/dt=!{timestamp:yyyy-MM-dd}/",
        bufferingHints: { intervalInSeconds: 300, sizeInMBs: 64 },
        compressionFormat: "GZIP",
        encryptionConfiguration: { kmsEncryptionConfig: { awskmsKeyArn: props.key.keyArn } },
      },
    });

    const db = new glue.CfnDatabase(this, "Db", {
      catalogId: stack.account,
      databaseInput: { name: `plain_theory_${props.stage}` },
    });

    // Raw DynamoDB stream records ({ eventName, dynamodb: { NewImage: {...} } }); query NewImage fields in Athena.
    const table = new glue.CfnTable(this, "Receipts", {
      catalogId: stack.account,
      databaseName: `plain_theory_${props.stage}`,
      tableInput: {
        name: "receipt_stream",
        tableType: "EXTERNAL_TABLE",
        parameters: {
          classification: "json",
          "projection.enabled": "true",
          "projection.dt.type": "date",
          "projection.dt.format": "yyyy-MM-dd",
          "projection.dt.range": "2025-01-01,NOW",
          "storage.location.template": `s3://${this.bucket.bucketName}/receipts/dt=\${dt}/`,
        },
        partitionKeys: [{ name: "dt", type: "string" }],
        storageDescriptor: {
          location: `s3://${this.bucket.bucketName}/receipts/`,
          inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          serdeInfo: { serializationLibrary: "org.openx.data.jsonserde.JsonSerDe" },
          columns: [
            { name: "eventname", type: "string" },
            { name: "dynamodb", type: "struct<NewImage:map<string,string>>" },
          ],
        },
      },
    });
    table.addDependency(db);
  }
}
