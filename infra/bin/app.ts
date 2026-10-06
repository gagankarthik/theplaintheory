#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack";
import { AuthStack } from "../lib/auth-stack";
import { DataStack } from "../lib/data-stack";
import { DeliveryStack } from "../lib/delivery-stack";

const app = new App();
const stage = (app.node.tryGetContext("stage") as string) ?? "prod";
const account = process.env.CDK_DEFAULT_ACCOUNT;
/** Where personal data lives. ap-south-1 (Mumbai) or ap-south-2 (Hyderabad) for DPDPA residency. */
const dataRegion = (app.node.tryGetContext("dataRegion") as string) ?? "ap-south-1";
const archive = String(app.node.tryGetContext("archive")) === "true";

const env = { account, region: dataRegion };

const data = new DataStack(app, `PlainTheory-${stage}-Data`, { env, stage, archive });
const auth = new AuthStack(app, `PlainTheory-${stage}-Auth`, { env, stage });
const delivery = new DeliveryStack(app, `PlainTheory-${stage}-Delivery`, {
  env,
  stage,
  cdnDomain: app.node.tryGetContext("cdnDomain") || undefined,
  certificateArn: app.node.tryGetContext("certificateArn") || undefined,
});
new AppStack(app, `PlainTheory-${stage}-App`, {
  env,
  stage,
  table: data.table,
  configBucket: delivery.bucket,
  distribution: delivery.distribution,
  userPool: auth.pool,
});

app.synth();
