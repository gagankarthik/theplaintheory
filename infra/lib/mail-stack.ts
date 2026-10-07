import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as ses from "aws-cdk-lib/aws-ses";
import type { Construct } from "constructs";
import type { Naming } from "./naming";
import { tagComponent } from "./tags";

export interface MailStackProps extends StackProps {
  naming: Naming;
  /** Sending domain, e.g. theplaintheory.in. Add the DKIM CNAMEs from the outputs to its DNS. */
  domain: string;
}

/**
 * SES domain identity with Easy DKIM and a custom MAIL FROM, plus a configuration set for
 * reputation metrics. Cognito, invites, alerts and support-access notices all send from here.
 * A new SES account starts in the sandbox: request production access for the account once DNS verifies.
 */
export class MailStack extends Stack {
  readonly identity: ses.EmailIdentity;
  readonly configurationSet: ses.ConfigurationSet;

  constructor(scope: Construct, id: string, props: MailStackProps) {
    super(scope, id, props);
    const { naming } = props;
    tagComponent(this, "mail", "confidential");

    this.configurationSet = new ses.ConfigurationSet(this, "Config", {
      configurationSetName: naming.global("mail"),
      reputationMetrics: true,
      suppressionReasons: ses.SuppressionReasons.BOUNCES_AND_COMPLAINTS,
    });

    this.identity = new ses.EmailIdentity(this, "Domain", {
      identity: ses.Identity.domain(props.domain),
      configurationSet: this.configurationSet,
      mailFromDomain: `mail.${props.domain}`,
      dkimSigning: true,
    });

    this.identity.dkimRecords.forEach((r, i) => new CfnOutput(this, `DkimRecord${i + 1}`, { value: `${r.name} CNAME ${r.value}`, description: "Add to DNS" }));
    new CfnOutput(this, "MailFrom", { value: `mail.${props.domain}: MX 10 feedback-smtp.${this.region}.amazonses.com and TXT "v=spf1 include:amazonses.com ~all"`, description: "Add to DNS" });
  }
}
