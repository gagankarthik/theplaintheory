import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
import type { TableId } from "./data-stack";
import type { Naming } from "./naming";
import { tagComponent } from "./tags";

/** The operations the app uses (an alarm's math expression is limited to 10 metrics). */
const OPERATIONS = [
  dynamodb.Operation.GET_ITEM,
  dynamodb.Operation.PUT_ITEM,
  dynamodb.Operation.UPDATE_ITEM,
  dynamodb.Operation.QUERY,
  dynamodb.Operation.TRANSACT_WRITE_ITEMS,
];

export interface ObservabilityStackProps extends StackProps {
  naming: Naming;
  tables: Record<TableId, dynamodb.ITable>;
  /** Who gets alarms and budget alerts */
  alertEmail?: string;
  /** Monthly AWS budget for this stage, USD */
  monthlyBudgetUsd: number;
}

/**
 * Alarms that page a human, and a budget scoped to Plain Theory's cost-allocation tags.
 * App-side signals (function errors, latency) come from Vercel; CloudFront metrics live in
 * us-east-1 and are added there when the CDN gets a custom domain.
 */
export class ObservabilityStack extends Stack {
  readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);
    const { naming } = props;
    tagComponent(this, "observability", "confidential");

    this.topic = new sns.Topic(this, "Alerts", { topicName: naming.name("alerts"), displayName: "Plain Theory alerts" });
    if (props.alertEmail) this.topic.addSubscription(new subs.EmailSubscription(props.alertEmail));
    const notify = new actions.SnsAction(this.topic);

    for (const [id, table] of Object.entries(props.tables) as [TableId, dynamodb.ITable][]) {
      // Any throttling on on-demand tables means a hot key or a runaway client; any system error is AWS-side.
      const alarms: [string, cloudwatch.IMetric, number][] = [
        ["throttles", table.metric("ThrottledRequests", { statistic: "Sum", period: Duration.minutes(5) }), 1],
        ["system-errors", table.metricSystemErrorsForOperations({ period: Duration.minutes(5), operations: OPERATIONS }), 1],
      ];
      for (const [signal, metric, threshold] of alarms) {
        new cloudwatch.Alarm(this, `${id}-${signal}`, {
          alarmName: naming.name(id, signal),
          metric,
          threshold,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }).addAlarmAction(notify);
      }
    }

    new budgets.CfnBudget(this, "Budget", {
      budget: {
        budgetName: naming.global("monthly"),
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
        // The accounts are Plain Theory only, so the stage tag scopes the budget (values in one filter are OR-ed).
        costFilters: { TagKeyValue: [`user:Environment$${naming.stage}`] },
      },
      notificationsWithSubscribers: props.alertEmail
        ? [80, 100].map((pct) => ({
            notification: { notificationType: pct === 100 ? "FORECASTED" : "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: pct, thresholdType: "PERCENTAGE" },
            subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail! }],
          }))
        : undefined,
    });
  }
}
