import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import type * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import type * as cognito from "aws-cdk-lib/aws-cognito";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as kms from "aws-cdk-lib/aws-kms";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type * as ses from "aws-cdk-lib/aws-ses";
import type { Construct } from "constructs";
import type { TableId } from "./data-stack";
import type { Naming } from "./naming";
import { tagComponent } from "./tags";

export interface AccessStackProps extends StackProps {
  naming: Naming;
  tables: Record<TableId, dynamodb.ITable>;
  key: kms.IKey;
  configBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  customerPool: cognito.IUserPool;
  staffPool: cognito.IUserPool;
  mailIdentity?: ses.IEmailIdentity;
  /**
   * Vercel OIDC federation (preferred: no stored keys). When omitted, an IAM user is created instead
   * and its access key is issued with the CLI (never through CloudFormation, so it's not in a template).
   */
  vercel?: {
    /** Vercel team slug: the OIDC issuer is https://oidc.vercel.com/<team> (team issuer mode) */
    team: string;
    project: string;
    /** ["production"] for prod; ["preview"] for staging */
    environments: string[];
    /** One OIDC provider per AWS account: pass its ARN when another stage already created it */
    existingProviderArn?: string;
  };
}

const READ = ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:ConditionCheckItem", "dynamodb:DescribeTable"];
const WRITE = ["dynamodb:PutItem", "dynamodb:UpdateItem"];
const DELETE = ["dynamodb:DeleteItem", "dynamodb:BatchWriteItem"];

const arns = (t: dynamodb.ITable) => [t.tableArn, `${t.tableArn}/index/*`];

/**
 * What the Vercel app may do in AWS (docs/architecture/platform-architecture.md §8), as two
 * least-privilege managed policies:
 *
 *   pt-{stage}-app      dashboard + staff console: accounts, sites, logs, audit (append-only), leads, mail
 *   pt-{stage}-ingest   public endpoints (consent, events, leaks, contact form): write-mostly; can't read
 *                       leads, can't write accounts, can't touch the audit trail
 *
 * They're attached to Vercel OIDC roles when `vercel` is set, otherwise to one IAM user,
 * pt-{stage}-vercel-app, whose keys live only in Vercel's encrypted env vars.
 */
export class AccessStack extends Stack {
  readonly appPolicy: iam.ManagedPolicy;
  readonly ingestPolicy: iam.ManagedPolicy;

  constructor(scope: Construct, id: string, props: AccessStackProps) {
    super(scope, id, props);
    const { naming, tables } = props;
    tagComponent(this, "access", "confidential");

    const tableStatement = (actions: string[], ...ts: dynamodb.ITable[]) => new iam.PolicyStatement({ actions, resources: ts.flatMap(arns) });
    const auditAppendOnly = new iam.PolicyStatement({ effect: iam.Effect.DENY, actions: ["dynamodb:UpdateItem", ...DELETE], resources: arns(tables.audit) });
    const kmsUse = new iam.PolicyStatement({ actions: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey", "kms:DescribeKey"], resources: [props.key.keyArn] });

    // ---- Dashboard and staff console ----
    const appStatements = [
      tableStatement([...READ, ...WRITE, ...DELETE, "dynamodb:TransactWriteItems"], tables.core, tables.ephemeral, tables.telemetry, tables.leads),
      // Receipts: read, export and retention deletes. New receipts come from the ingest policy.
      tableStatement([...READ, ...DELETE], tables.receipts),
      tableStatement([...READ, "dynamodb:PutItem"], tables.audit),
      auditAppendOnly,
      kmsUse,
      new iam.PolicyStatement({ actions: ["s3:PutObject"], resources: [props.configBucket.arnForObjects("c/*")] }),
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [`arn:aws:cloudfront::${this.account}:distribution/${props.distribution.distributionId}`],
      }),
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:SignUp",
          "cognito-idp:ConfirmSignUp",
          "cognito-idp:ResendConfirmationCode",
          "cognito-idp:InitiateAuth",
          "cognito-idp:RespondToAuthChallenge",
          "cognito-idp:ForgotPassword",
          "cognito-idp:ConfirmForgotPassword",
          "cognito-idp:ChangePassword",
          "cognito-idp:GetUser",
          "cognito-idp:GlobalSignOut",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminUserGlobalSignOut",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AssociateSoftwareToken",
          "cognito-idp:VerifySoftwareToken",
          "cognito-idp:ListUsers",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:ListUsersInGroup",
          // Staff "trust this browser for 30 days" (remembered devices on the staff pool)
          "cognito-idp:ConfirmDevice",
          "cognito-idp:UpdateDeviceStatus",
          "cognito-idp:AdminListDevices",
          "cognito-idp:AdminForgetDevice",
        ],
        resources: [props.customerPool.userPoolArn, props.staffPool.userPoolArn],
      }),
    ];
    if (props.mailIdentity) {
      appStatements.push(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: [`arn:aws:ses:${this.region}:${this.account}:identity/${props.mailIdentity.emailIdentityName}`, `arn:aws:ses:${this.region}:${this.account}:configuration-set/*`],
        }),
      );
    }
    this.appPolicy = new iam.ManagedPolicy(this, "AppPolicy", {
      managedPolicyName: naming.global("app"),
      description: "Plain Theory dashboard and staff console",
      statements: appStatements,
    });

    // ---- Public endpoints ----
    this.ingestPolicy = new iam.ManagedPolicy(this, "IngestPolicy", {
      managedPolicyName: naming.global("ingest"),
      description: "Plain Theory public consent API and contact form",
      statements: [
        tableStatement(READ, tables.core), // site-key and config lookups only
        tableStatement([...READ, ...WRITE, "dynamodb:TransactWriteItems"], tables.receipts), // append receipts, advance chain heads
        tableStatement([...WRITE, "dynamodb:GetItem"], tables.telemetry), // counters and leak reports
        tableStatement([...READ, ...WRITE, "dynamodb:DeleteItem"], tables.ephemeral), // rate-limit windows
        // Leads: submit only; Query limited to the email index for duplicate checks, so it can't read the inbox.
        new iam.PolicyStatement({ actions: ["dynamodb:PutItem"], resources: [tables.leads.tableArn] }),
        new iam.PolicyStatement({ actions: ["dynamodb:Query"], resources: [`${tables.leads.tableArn}/index/GSI2`] }),
        kmsUse,
        auditAppendOnly,
      ],
    });

    if (props.vercel) {
      const { team, project, environments } = props.vercel;
      const issuer = `oidc.vercel.com/${team}`;
      const providerArn =
        props.vercel.existingProviderArn ??
        new iam.OidcProviderNative(this, "VercelOidc", { oidcProviderName: issuer, url: `https://${issuer}`, clientIds: [`https://vercel.com/${team}`] }).oidcProviderArn;
      const trust = new iam.FederatedPrincipal(
        providerArn,
        {
          StringEquals: { [`${issuer}:aud`]: `https://vercel.com/${team}` },
          StringLike: { [`${issuer}:sub`]: environments.map((e) => `owner:${team}:project:${project}:environment:${e}`) },
        },
        "sts:AssumeRoleWithWebIdentity",
      );
      const role = (component: string, policy: iam.ManagedPolicy, description: string) =>
        new iam.Role(this, component, { roleName: naming.global(component), assumedBy: trust, description, maxSessionDuration: Duration.hours(1), managedPolicies: [policy] });
      const runtime = role("vercel-runtime", this.appPolicy, "Plain Theory dashboard and staff console (Vercel OIDC)");
      const ingest = role("vercel-ingest", this.ingestPolicy, "Plain Theory public endpoints (Vercel OIDC)");
      new CfnOutput(this, "RuntimeRoleArn", { value: runtime.roleArn, description: "AWS_ROLE_ARN" });
      new CfnOutput(this, "IngestRoleArn", { value: ingest.roleArn, description: "AWS_INGEST_ROLE_ARN" });
    } else {
      // One deployment serves both the dashboard and the public endpoints, so the user carries both policies.
      const user = new iam.User(this, "AppUser", { userName: naming.global("vercel-app"), managedPolicies: [this.appPolicy, this.ingestPolicy] });
      new CfnOutput(this, "AppUserName", { value: user.userName, description: "Issue keys with: aws iam create-access-key --user-name <this>" });
    }
  }
}
