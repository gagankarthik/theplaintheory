import { Duration, SecretValue, Stack, type StackProps } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import type { Construct } from "constructs";
import type { Naming } from "./naming";
import { tagComponent } from "./tags";

export interface JobsStackProps extends StackProps {
  naming: Naming;
  /** the app's public origin, e.g. https://www.theplaintheory.in */
  appUrl: string;
  /**
   * Secrets Manager secret holding the internal cron secret (the same value as the app's
   * INTERNAL_CRON_SECRET). Created out of band, never in code or context.
   */
  cronSecretName: string;
}

/**
 * Jobs that must run more often than Vercel Cron allows: every minute, EventBridge calls the app's
 * webhook retry drain (/api/internal/webhooks/drain), so retries go out on time even when a site has
 * no traffic. The endpoint answers 202 at once and drains in the background.
 */
export class JobsStack extends Stack {
  constructor(scope: Construct, id: string, props: JobsStackProps) {
    super(scope, id, props);
    const { naming } = props;

    const connection = new events.Connection(this, "AppConnection", {
      connectionName: naming.name("jobs-app"),
      description: "Plain Theory internal job routes (bearer secret)",
      // cron-auth accepts the secret with or without a "Bearer " prefix
      authorization: events.Authorization.apiKey("Authorization", SecretValue.secretsManager(props.cronSecretName)),
    });

    const drain = new events.ApiDestination(this, "WebhookDrain", {
      apiDestinationName: naming.name("webhook-drain"),
      description: "Send due webhook retries",
      connection,
      endpoint: `${props.appUrl.replace(/\/$/, "")}/api/internal/webhooks/drain`,
      httpMethod: events.HttpMethod.POST,
      rateLimitPerSecond: 1,
    });

    new events.Rule(this, "WebhookDrainEveryMinute", {
      ruleName: naming.name("webhook-drain"),
      description: "Every minute: send due webhook retries",
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [new targets.ApiDestination(drain, { retryAttempts: 0, event: events.RuleTargetInput.fromObject({}) })],
    });

    tagComponent(this, "jobs");
  }
}
