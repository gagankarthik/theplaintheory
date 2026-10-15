import * as path from "node:path";
import { CfnOutput, Duration, IgnoreMode, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AdjustmentType } from "aws-cdk-lib/aws-applicationautoscaling";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { TableId } from "./data-stack";
import type { Naming } from "./naming";
import { tagComponent } from "./tags";

/** Repository root (infra/ is one level down). */
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOCKERFILE = "services/crawler/Dockerfile";

/**
 * Same selection as services/crawler/Dockerfile.dockerignore: only the dashboard's src/lib (reused by
 * the worker) and the crawler service itself go into the build.
 */
const BUILD_CONTEXT_EXCLUDES = ["*", "!src", "!src/lib/**", "!services", "!services/crawler/**", "services/crawler/node_modules", "services/crawler/dist", "**/*.test.ts"];

/* ------------------------------------------------------------------------------------------------
 * CrawlerImages: ECR repository + a CodeBuild project that builds the crawler image in AWS.
 * Deployed before the Crawler stack, so no local Docker is needed:
 *
 *   npx cdk deploy PlainTheory-Staging-CrawlerImages -c stage=staging
 *   aws codebuild start-build --project-name pt-staging-aps1-crawler-image   (tag defaults to the source hash)
 *   npx cdk deploy PlainTheory-Staging-Crawler -c stage=staging -c crawlerImage=<RepositoryUri>:<ImageTag>
 *
 * Tags are immutable and there is no `latest`: every deploy names the exact image it runs, so a task
 * definition revision always maps to one build, and rolling back is redeploying the previous tag. To tag
 * by commit instead of source hash, override it when starting the build:
 *   aws codebuild start-build --project-name ... --environment-variables-override name=IMAGE_TAG,value=$(git rev-parse --short=12 HEAD)
 * A build whose tag already exists in the repository is skipped (the tag can't be overwritten).
 * ---------------------------------------------------------------------------------------------- */

export interface CrawlerImagesStackProps extends StackProps {
  naming: Naming;
}

export class CrawlerImagesStack extends Stack {
  readonly repository: ecr.Repository;
  readonly project: codebuild.Project;
  /** Tag the build pushes by default: the hash of the build context. */
  readonly imageTag: string;

  constructor(scope: Construct, id: string, props: CrawlerImagesStackProps) {
    super(scope, id, props);
    const { naming } = props;
    tagComponent(this, "crawler", "confidential");

    this.repository = new ecr.Repository(this, "Repository", {
      repositoryName: naming.name("crawler"),
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: naming.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      emptyOnDelete: naming.stage !== "prod",
      lifecycleRules: [{ description: "Keep the last 10 images", maxImageCount: 10 }],
    });

    const source = new s3assets.Asset(this, "BuildContext", {
      path: REPO_ROOT,
      ignoreMode: IgnoreMode.DOCKER,
      exclude: BUILD_CONTEXT_EXCLUDES,
    });
    this.imageTag = source.assetHash.slice(0, 16);

    this.project = new codebuild.Project(this, "ImageBuild", {
      projectName: naming.name("crawler-image"),
      description: "Builds services/crawler/Dockerfile and pushes it to ECR",
      source: codebuild.Source.s3({ bucket: source.bucket, path: source.s3ObjectKey }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true, // docker build
      },
      environmentVariables: {
        REPOSITORY_URI: { value: this.repository.repositoryUri },
        REPOSITORY_NAME: { value: this.repository.repositoryName },
        IMAGE_TAG: { value: this.imageTag },
        AWS_ACCOUNT_ID: { value: this.account },
      },
      timeout: Duration.minutes(30),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, "BuildLogs", {
            logGroupName: naming.logGroup("crawler-image"),
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        env: { variables: { DOCKER_BUILDKIT: "1" } },
        phases: {
          pre_build: {
            commands: ['aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"'],
          },
          build: {
            commands: [
              // Immutable tags: an existing tag is already the image for this source, so skip instead of failing the push.
              'if aws ecr describe-images --repository-name "$REPOSITORY_NAME" --image-ids imageTag="$IMAGE_TAG" >/dev/null 2>&1; then echo "$REPOSITORY_URI:$IMAGE_TAG exists; skipping build"; export SKIP_PUSH=1; fi',
              `if [ -z "$SKIP_PUSH" ]; then docker build --platform linux/amd64 -f ${DOCKERFILE} -t "$REPOSITORY_URI:$IMAGE_TAG" .; fi`,
            ],
          },
          post_build: {
            commands: [
              // post_build runs even when build failed; only push an image that was built.
              'if [ "$CODEBUILD_BUILD_SUCCEEDING" = "1" ] && [ -z "$SKIP_PUSH" ]; then docker push "$REPOSITORY_URI:$IMAGE_TAG"; fi',
              'echo "Image: $REPOSITORY_URI:$IMAGE_TAG"',
            ],
          },
        },
      }),
    });
    source.grantRead(this.project);
    this.repository.grantPullPush(this.project);
    this.repository.grant(this.project, "ecr:DescribeImages");

    new CfnOutput(this, "RepositoryUri", { value: this.repository.repositoryUri });
    new CfnOutput(this, "ImageTag", { value: this.imageTag });
    new CfnOutput(this, "ImageUri", { value: `${this.repository.repositoryUri}:${this.imageTag}`, description: "-c crawlerImage=<this> after the build succeeds" });
    new CfnOutput(this, "BuildProjectName", { value: this.project.projectName });
  }
}

/* ------------------------------------------------------------------------------------------------
 * Crawler: SQS crawl queue → ECS Fargate workers running headless Chromium (services/crawler).
 * ---------------------------------------------------------------------------------------------- */

export interface CrawlerStackProps extends StackProps {
  naming: Naming;
  tables: Record<TableId, dynamodb.ITable>;
  key: kms.IKey;
  /**
   * `-c crawlerImage=<repositoryUri>:<tag>` (the CrawlerImages stack's ImageUri output; no Docker needed),
   * or any registry reference pinned by tag or digest. Omitted: built from services/crawler/Dockerfile by
   * `cdk deploy` (needs Docker).
   */
  imageRef?: string;
  /** Most tasks running at once. */
  maxTasks: number;
}

const READ = ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:DescribeTable"];

export class CrawlerStack extends Stack {
  readonly queue: sqs.Queue;
  readonly deadLetterQueue: sqs.Queue;
  readonly cluster: ecs.Cluster;
  readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: CrawlerStackProps) {
    super(scope, id, props);
    const { naming, tables } = props;
    tagComponent(this, "crawler", "confidential");

    // Public subnets only, no NAT gateway: crawl tasks need outbound internet access to the sites they
    // scan and never accept inbound connections (security group has no ingress). That saves the NAT
    // gateway's hourly and per-GB cost. DynamoDB traffic stays on the AWS network through a free
    // gateway endpoint.
    const vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: naming.name("crawler"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
      gatewayEndpoints: { DynamoDb: { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB } },
    });
    const securityGroup = new ec2.SecurityGroup(this, "TaskSecurityGroup", {
      vpc,
      securityGroupName: naming.name("crawler-task"),
      description: "Crawler tasks: outbound only",
      allowAllOutbound: true,
    });

    this.deadLetterQueue = new sqs.Queue(this, "CrawlDeadLetterQueue", {
      queueName: naming.name("crawl-dlq"),
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });
    this.queue = new sqs.Queue(this, "CrawlQueue", {
      queueName: naming.name("crawl-queue"),
      // A full multi-page crawl takes minutes; the worker also extends visibility while it runs.
      visibilityTimeout: Duration.minutes(15),
      retentionPeriod: Duration.days(1),
      receiveMessageWaitTime: Duration.seconds(20),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 3 },
    });

    this.cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: naming.name("crawler"),
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
      enableFargateCapacityProviders: true,
    });

    const image = props.imageRef
      ? imageFromRef(this, props.imageRef)
      : ecs.ContainerImage.fromAsset(REPO_ROOT, { file: DOCKERFILE, ignoreMode: IgnoreMode.DOCKER, exclude: BUILD_CONTEXT_EXCLUDES });

    const logGroup = new logs.LogGroup(this, "CrawlerLogs", {
      logGroupName: naming.logGroup("crawler"),
      retention: naming.stage === "prod" ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_MONTH,
      removalPolicy: naming.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // X86_64: Debian's chromium package is built for amd64 and arm64, but crawl fidelity is tested on amd64.
    // Sized for CRAWLER_CONCURRENCY=1 (one Chromium, one page at a time): a heavy page's renderer peaks
    // around 1-1.5 GB next to ~300 MB for the browser process and Node, so 3 GB leaves headroom, and one
    // vCPU keeps a single page responsive. More throughput comes from more tasks (backlog scaling below),
    // not bigger ones; raise both together if concurrency goes up. The default 20 GiB of ephemeral
    // storage holds /tmp (profile and shared memory, a few hundred MB at most).
    const taskDefinition = new ecs.FargateTaskDefinition(this, "CrawlerTask", {
      family: naming.name("crawler"),
      cpu: 1024,
      memoryLimitMiB: 3072,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.X86_64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
    });
    // Read-only root filesystem: the only writable path is /tmp, a task-scoped volume on ephemeral
    // storage (Fargate has no tmpfs). The image's /tmp (mode 1777) seeds it, so the non-root user can write.
    taskDefinition.addVolume({ name: "tmp" });
    // No Linux capabilities at all: Node and Chromium (--no-sandbox, see services/crawler/src/scanner/browser.ts)
    // need none, and the image runs as the non-root `node` user.
    const linuxParameters = new ecs.LinuxParameters(this, "CrawlerLinuxParameters");
    linuxParameters.dropCapabilities(ecs.Capability.ALL);
    const container = taskDefinition.addContainer("crawler", {
      image,
      essential: true,
      readonlyRootFilesystem: true,
      linuxParameters,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "crawler", logGroup }),
      environment: {
        NODE_ENV: "production",
        STORE_DRIVER: "dynamodb",
        CRAWLER_QUEUE_URL: this.queue.queueUrl,
        CRAWLER_CONCURRENCY: "1",
        // Under the queue's 15-minute visibility timeout; a crawl that hits it stops and keeps partial results.
        CRAWLER_SCAN_DEADLINE_MS: String(10 * 60_000),
        PT_AWS_REGION: this.region,
        AWS_REGION: this.region,
        DYNAMO_TABLE_CORE: tables.core.tableName,
        DYNAMO_TABLE_RECEIPTS: tables.receipts.tableName,
        DYNAMO_TABLE_TELEMETRY: tables.telemetry.tableName,
        DYNAMO_TABLE_AUDIT: tables.audit.tableName,
        DYNAMO_TABLE_LEADS: tables.leads.tableName,
        DYNAMO_TABLE_EPHEMERAL: tables.ephemeral.tableName,
      },
      // SIGTERM → stop the crawl, hand the scan back to the queue, exit.
      stopTimeout: Duration.seconds(120),
    });
    container.addMountPoints({ sourceVolume: "tmp", containerPath: "/tmp", readOnly: false });

    // Least privilege: sites and scan reports (core), append-only audit events, the data key, the queue.
    const role = taskDefinition.taskRole;
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [...READ, "dynamodb:PutItem", "dynamodb:UpdateItem"],
        resources: [tables.core.tableArn, `${tables.core.tableArn}/index/*`],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({ actions: [...READ, "dynamodb:PutItem"], resources: [tables.audit.tableArn, `${tables.audit.tableArn}/index/*`] }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ["dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem"],
        resources: [tables.audit.tableArn, `${tables.audit.tableArn}/index/*`],
      }),
    );
    role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey", "kms:DescribeKey"], resources: [props.key.keyArn] }));
    this.queue.grantConsumeMessages(role);

    this.service = new ecs.FargateService(this, "CrawlerService", {
      serviceName: naming.name("crawler"),
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 0,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [securityGroup],
      circuitBreaker: { enable: true, rollback: true },
      capacityProviderStrategies:
        naming.stage === "prod"
          ? [
              { capacityProvider: "FARGATE_SPOT", weight: 2 },
              { capacityProvider: "FARGATE", weight: 1 },
            ]
          : [{ capacityProvider: "FARGATE_SPOT", weight: 1 }],
    });

    // Scale 0 → N on backlog. In-flight messages count too, so a task finishing a crawl is never
    // scaled in underneath itself.
    const backlog = new cloudwatch.MathExpression({
      label: "Crawl backlog (visible + in flight)",
      expression: "visible + inflight",
      period: Duration.minutes(1),
      usingMetrics: {
        visible: this.queue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(1), statistic: "Maximum" }),
        inflight: this.queue.metricApproximateNumberOfMessagesNotVisible({ period: Duration.minutes(1), statistic: "Maximum" }),
      },
    });
    const maxTasks = Math.max(1, props.maxTasks);
    this.service.autoScaleTaskCount({ minCapacity: 0, maxCapacity: maxTasks }).scaleOnMetric("BacklogScaling", {
      metric: backlog,
      adjustmentType: AdjustmentType.EXACT_CAPACITY,
      cooldown: Duration.seconds(60),
      evaluationPeriods: 1,
      scalingSteps: [
        { upper: 1, change: 0 },
        { lower: 1, upper: 3, change: 1 },
        { lower: 3, upper: 10, change: Math.min(2, maxTasks) },
        { lower: 10, change: maxTasks },
      ],
    });

    new cloudwatch.Alarm(this, "DeadLetterAlarm", {
      alarmName: naming.name("crawler", "dlq"),
      alarmDescription: "Crawl requests failed 3 times and were moved to the dead-letter queue",
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5), statistic: "Maximum" }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, "QueueAgeAlarm", {
      alarmName: naming.name("crawler", "queue-age"),
      alarmDescription: "The oldest crawl request has waited more than 15 minutes",
      metric: this.queue.metricApproximateAgeOfOldestMessage({ period: Duration.minutes(5), statistic: "Maximum" }),
      threshold: 900,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new CfnOutput(this, "CrawlQueueUrl", { value: this.queue.queueUrl, description: "Vercel env CRAWLER_QUEUE_URL" });
    new CfnOutput(this, "CrawlQueueArn", { value: this.queue.queueArn });
    new CfnOutput(this, "CrawlDeadLetterQueueUrl", { value: this.deadLetterQueue.queueUrl });
    new CfnOutput(this, "ClusterName", { value: this.cluster.clusterName });
  }
}

/**
 * An ECR image from the CrawlerImages stack (pull permission granted), or any other registry reference.
 * The reference must pin an immutable tag or a digest (`repo:<tag>` or `repo@sha256:<digest>`): a bare
 * repository or `:latest` is refused, so every task definition revision names exactly one build.
 */
function imageFromRef(scope: Construct, ref: string): ecs.ContainerImage {
  const pinned = /@sha256:[0-9a-f]{64}$/.test(ref) || /:[\w][\w.-]{0,127}$/.test(ref.slice(ref.lastIndexOf("/") + 1));
  if (!pinned || /:latest$/.test(ref)) {
    throw new Error(`-c crawlerImage must pin an image tag or digest (got "${ref}"). Use the CrawlerImages stack's ImageUri output.`);
  }
  const m = ref.match(/^(\d{12})\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com\/([^:@]+)(?::([^@]+)|@(sha256:[0-9a-f]{64}))$/);
  if (!m) return ecs.ContainerImage.fromRegistry(ref);
  const [, account, region, name, tag, digest] = m;
  const repository = ecr.Repository.fromRepositoryAttributes(scope, "CrawlerRepository", {
    repositoryName: name,
    repositoryArn: `arn:aws:ecr:${region}:${account}:repository/${name}`,
  });
  return ecs.ContainerImage.fromEcrRepository(repository, digest ?? tag);
}
