#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { AccessStack } from "../lib/access-stack";
import { IdentityStack } from "../lib/auth-stack";
import { CrawlerImagesStack, CrawlerStack } from "../lib/crawler-stack";
import { DataStack } from "../lib/data-stack";
import { DeliveryStack } from "../lib/delivery-stack";
import { JobsStack } from "../lib/jobs-stack";
import { MailStack } from "../lib/mail-stack";
import { Naming, STAGES, type Stage } from "../lib/naming";
import { ObservabilityStack } from "../lib/observability-stack";
import { applyBaseTags, enforceTags } from "../lib/tags";

/**
 * Plain Theory infrastructure, one stage per deploy (docs/architecture/platform-architecture.md).
 *   npx cdk deploy --all -c stage=staging -c vercelTeam=<slug> -c vercelProject=theplaintheory -c sesDomain=theplaintheory.in
 */
const app = new App();
const ctx = (key: string) => (app.node.tryGetContext(key) as string | undefined) || undefined;

const stage = (ctx("stage") ?? "staging") as Stage;
if (!STAGES.includes(stage)) throw new Error(`Unknown stage "${stage}". Use one of: ${STAGES.join(", ")}.`);
/** Where personal data lives. ap-south-1 (Mumbai) for DPDPA residency; Vercel functions run in bom1 beside it. */
const region = ctx("dataRegion") ?? "ap-south-1";
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region };
const naming = new Naming(stage, region);

applyBaseTags(app, stage);
enforceTags(app);

const data = new DataStack(app, naming.stack("data"), { env, naming, archive: ctx("archive") === "true" });

const sesDomain = ctx("sesDomain");
const mail = sesDomain ? new MailStack(app, naming.stack("mail"), { env, naming, domain: sesDomain }) : undefined;

const identity = new IdentityStack(app, naming.stack("identity"), {
  env,
  naming,
  // Only send through SES once the domain has verified (-c sesVerified=true); until then Cognito's sender is used.
  sesDomain: ctx("sesVerified") === "true" ? sesDomain : undefined,
});

const delivery = new DeliveryStack(app, naming.stack("delivery"), {
  env,
  naming,
  cdnDomain: ctx("cdnDomain"),
  certificateArn: ctx("certificateArn"),
});

// Headless tracker crawler (services/crawler). Build the image without local Docker:
//   deploy CrawlerImages → aws codebuild start-build → deploy Crawler with -c crawlerImage=<uri>:<tag>
// (docs/architecture/crawler.md). -c crawler=false leaves both stacks out.
const crawlerEnabled = ctx("crawler") !== "false";
if (crawlerEnabled) new CrawlerImagesStack(app, naming.stack("crawlerImages"), { env, naming });
const crawler = crawlerEnabled
  ? new CrawlerStack(app, naming.stack("crawler"), {
      env,
      naming,
      tables: data.tables,
      key: data.key,
      imageRef: ctx("crawlerImage"),
      maxTasks: Number(ctx("crawlerMaxTasks") ?? (stage === "prod" ? 6 : 2)),
    })
  : undefined;

const vercelTeam = ctx("vercelTeam");
new AccessStack(app, naming.stack("access"), {
  env,
  naming,
  tables: data.tables,
  key: data.key,
  configBucket: delivery.bucket,
  distribution: delivery.distribution,
  customerPool: identity.customers,
  staffPool: identity.staff,
  mailIdentity: mail?.identity,
  crawlQueue: crawler?.queue,
  // With a Vercel team slug: keyless OIDC roles. Without: one least-privilege IAM user for the app.
  vercel: vercelTeam
    ? {
        team: vercelTeam,
        project: ctx("vercelProject") ?? "theplaintheory",
        environments: stage === "prod" ? ["production"] : stage === "staging" ? ["preview"] : ["development"],
        existingProviderArn: ctx("oidcProviderArn"),
      }
    : undefined,
});

new ObservabilityStack(app, naming.stack("observability"), {
  env,
  naming,
  tables: data.tables,
  alertEmail: ctx("alertEmail"),
  monthlyBudgetUsd: Number(ctx("monthlyBudgetUsd") ?? (stage === "prod" ? 200 : 50)),
});

// Per-minute jobs (webhook retries). Needs a Secrets Manager secret holding INTERNAL_CRON_SECRET:
//   -c cronSecretName=pt-prod-cron-secret [-c appUrl=https://www.theplaintheory.in]
const cronSecretName = ctx("cronSecretName");
if (cronSecretName) {
  new JobsStack(app, naming.stack("jobs"), { env, naming, cronSecretName, appUrl: ctx("appUrl") ?? "https://www.theplaintheory.in" });
}

app.synth();
