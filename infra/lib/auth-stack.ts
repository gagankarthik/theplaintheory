import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";
import type { Naming } from "./naming";
import { tagComponent } from "./tags";

export interface IdentityStackProps extends StackProps {
  naming: Naming;
  /** Verified SES domain to send Cognito mail from. Without it Cognito's default sender is used
   *  (50 emails a day), which is what runs until SES is set up. */
  sesDomain?: string;
}

/** Staff roles are groups in the staff pool (docs/architecture/platform-architecture.md §7.2). */
export const STAFF_GROUPS = {
  "platform-superadmin": "Everything, including staff management, suspension and break-glass access",
  "platform-support": "Customer metadata, unlock and sign-out, contact requests, time-boxed support access",
  "platform-billing": "Plans, comps and refunds",
  "platform-analyst": "Metrics and lists only",
} as const;

const passwordPolicy: cognito.PasswordPolicy = {
  minLength: 12,
  requireDigits: true,
  requireSymbols: true,
  requireLowercase: true,
  requireUppercase: false,
  tempPasswordValidity: Duration.days(3),
};

/**
 * Two user pools, so customers and Plain Theory's own team never share an identity system:
 *
 *   pt-{stage}-{rc}-customers  self sign-up with email verification; optional TOTP (an organization can
 *                              require it). Roles live per organization in the core table, not here.
 *   pt-{stage}-{rc}-staff      invite-only (AdminCreateUser); TOTP enforced by Cognito on every sign-in;
 *                              short sessions; roles are the platform-* groups.
 */
export class IdentityStack extends Stack {
  readonly customers: cognito.UserPool;
  readonly staff: cognito.UserPool;

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props);
    const { naming } = props;
    tagComponent(this, "identity", "personal");

    const email = props.sesDomain
      ? cognito.UserPoolEmail.withSES({ fromEmail: `no-reply@${props.sesDomain}`, fromName: "Plain Theory", sesVerifiedDomain: props.sesDomain, sesRegion: this.region })
      : undefined;

    // Server-side auth only: the app runs each flow and keeps its own session, so no hosted UI or OAuth.
    const webClient = (pool: cognito.UserPool, refresh: Duration) =>
      pool.addClient("Web", {
        userPoolClientName: naming.global("web"),
        authFlows: { userPassword: true, userSrp: true },
        generateSecret: false,
        preventUserExistenceErrors: true,
        enableTokenRevocation: true,
        accessTokenValidity: Duration.hours(1),
        idTokenValidity: Duration.hours(1),
        refreshTokenValidity: refresh,
      });

    // ---- Customers ----
    this.customers = new cognito.UserPool(this, "Customers", {
      userPoolName: naming.name("customers"),
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      keepOriginal: { email: true },
      standardAttributes: { email: { required: true, mutable: true }, fullname: { required: false, mutable: true } },
      passwordPolicy,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      email,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const customerClient = webClient(this.customers, Duration.days(30));

    // ---- Staff ----
    this.staff = new cognito.UserPool(this, "Staff", {
      userPoolName: naming.name("staff"),
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      standardAttributes: { email: { required: true, mutable: false }, fullname: { required: true, mutable: true } },
      passwordPolicy: { ...passwordPolicy, tempPasswordValidity: Duration.days(1) },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },
      // "Trust this browser for 30 days": every new device still gets the TOTP challenge, and a
      // device is only remembered when the staff member ticks the box (the console calls
      // ConfirmDevice + UpdateDeviceStatus). A remembered device answers Cognito's device SRP
      // challenge instead of the code, so MFA stays REQUIRED and Cognito, not the app, skips it.
      // An in-place update of the pool (DeviceConfiguration), not a replacement.
      deviceTracking: { challengeRequiredOnNewDevice: true, deviceOnlyRememberedOnUserPrompt: true },
      // A superadmin resets staff passwords; there's no self-service recovery for the console.
      accountRecovery: cognito.AccountRecovery.NONE,
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      userInvitation: {
        emailSubject: "Your Plain Theory staff account",
        emailBody:
          "You've been invited to the Plain Theory staff console. Sign in at /admin/login with {username} and the temporary password {####}. You'll choose a new password and set up an authenticator app.",
      },
      email,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    for (const [name, description] of Object.entries(STAFF_GROUPS)) {
      new cognito.CfnUserPoolGroup(this, `StaffGroup-${name}`, { userPoolId: this.staff.userPoolId, groupName: name, description });
    }
    const staffClient = webClient(this.staff, Duration.hours(8));

    new CfnOutput(this, "CustomerPoolId", { value: this.customers.userPoolId, description: "COGNITO_CUSTOMER_POOL_ID" });
    new CfnOutput(this, "CustomerClientId", { value: customerClient.userPoolClientId, description: "COGNITO_CUSTOMER_CLIENT_ID" });
    new CfnOutput(this, "StaffPoolId", { value: this.staff.userPoolId, description: "COGNITO_STAFF_POOL_ID" });
    new CfnOutput(this, "StaffClientId", { value: staffClient.userPoolClientId, description: "COGNITO_STAFF_CLIENT_ID" });
    new CfnOutput(this, "CognitoRegion", { value: this.region, description: "COGNITO_REGION" });
  }
}
