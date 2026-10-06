import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

/** Dashboard sign-in: email + password, optional TOTP MFA. Used when AUTH_DRIVER=cognito. */
export class AuthStack extends Stack {
  readonly pool: cognito.UserPool;
  readonly client: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: StackProps & { stage: string }) {
    super(scope, id, props);

    this.pool = new cognito.UserPool(this, "Users", {
      userPoolName: `plain-theory-${props.stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true }, fullname: { required: false, mutable: true } },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireSymbols: true,
        requireLowercase: true,
        requireUppercase: false,
        tempPasswordValidity: Duration.days(3),
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.client = this.pool.addClient("Dashboard", {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    new CfnOutput(this, "UserPoolId", { value: this.pool.userPoolId });
    new CfnOutput(this, "ClientId", { value: this.client.userPoolClientId, description: "COGNITO_CLIENT_ID" });
    new CfnOutput(this, "CognitoRegion", { value: this.region, description: "COGNITO_REGION" });
  }
}
