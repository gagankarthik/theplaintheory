import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import type * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import type * as cognito from "aws-cdk-lib/aws-cognito";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface AppStackProps extends StackProps {
  stage: string;
  table: dynamodb.ITable;
  configBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  userPool: cognito.IUserPool;
}

/**
 * Runtime permissions for the Next.js dashboard + API (least privilege).
 * Attach the role to the Amplify Hosting compute role, or use it as the ECS Fargate task role.
 * Hosting itself is created from the Amplify console / `amplify` CLI because it needs repository access;
 * see infra/README.md for the environment variables to set there.
 */
export class AppStack extends Stack {
  readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.role = new iam.Role(this, "AppRuntime", {
      roleName: `plain-theory-${props.stage}-app`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("amplify.amazonaws.com"),
        new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      ),
      description: "Next.js app: read/write tenant data, publish configs, invalidate CDN",
    });

    props.table.grantReadWriteData(this.role);
    props.configBucket.grantPut(this.role, "c/*");
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [`arn:aws:cloudfront::${this.account}:distribution/${props.distribution.distributionId}`],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:SignUp", "cognito-idp:InitiateAuth", "cognito-idp:GetUser"],
        resources: [props.userPool.userPoolArn],
      }),
    );

    new CfnOutput(this, "AppRoleArn", { value: this.role.roleArn });
  }
}
