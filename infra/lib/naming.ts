/**
 * One naming scheme for every Plain Theory resource (docs/architecture/platform-architecture.md §4):
 *
 *   resources   pt-{stage}-{regionCode}-{component}[-{qualifier}]    e.g. pt-prod-aps1-core
 *   global      pt-{stage}-{component}                               e.g. pt-prod-vercel-runtime
 *   S3 buckets  pt-{stage}-{regionCode}-{component}-{accountId}     (globally unique)
 *   stacks      PlainTheory-{Stage}-{Component}                      e.g. PlainTheory-Prod-Data
 */
export type Stage = "prod" | "staging" | "dev";

export const STAGES: Stage[] = ["prod", "staging", "dev"];

const REGION_CODES: Record<string, string> = {
  "ap-south-1": "aps1",
  "ap-south-2": "aps2",
  "eu-central-1": "euc1",
  "us-east-1": "use1",
  "us-east-2": "use2",
};

export function regionCode(region: string) {
  const code = REGION_CODES[region];
  if (!code) throw new Error(`No short code for region ${region}. Add it to REGION_CODES in lib/naming.ts.`);
  return code;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class Naming {
  constructor(
    readonly stage: Stage,
    readonly region: string,
  ) {}

  /** Regional resource: pt-prod-aps1-core */
  name(component: string, qualifier?: string) {
    return ["pt", this.stage, regionCode(this.region), component, qualifier].filter(Boolean).join("-");
  }

  /** Global resource (IAM, CloudFront): pt-prod-vercel-runtime */
  global(component: string, qualifier?: string) {
    return ["pt", this.stage, component, qualifier].filter(Boolean).join("-");
  }

  /** Globally unique bucket: pt-prod-aps1-config-417915984158 */
  bucket(component: string, account: string) {
    return `${this.name(component)}-${account}`;
  }

  /** CloudFormation stack: PlainTheory-Prod-Data */
  stack(component: string) {
    return `PlainTheory-${title(this.stage)}-${title(component)}`;
  }

  /** KMS alias: alias/pt-prod-aps1-data */
  alias(component: string) {
    return `alias/${this.name(component)}`;
  }

  /** CloudWatch log group: /pt/prod/consent-api */
  logGroup(component: string) {
    return `/pt/${this.stage}/${component}`;
  }
}
