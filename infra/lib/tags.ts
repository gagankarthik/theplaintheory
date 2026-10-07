import { Annotations, AspectPriority, Aspects, CfnResource, type IAspect, Tags, TagManager } from "aws-cdk-lib";
import type { IConstruct } from "constructs";
import type { Stage } from "./naming";

/**
 * The tag set every Plain Theory resource carries (docs/architecture/platform-architecture.md §5).
 * Applied once at the app root; `Component` and `DataClassification` are set per stack or resource.
 */
export const REQUIRED_TAGS = ["Project", "Environment", "Component", "Owner", "CostCenter", "DataClassification", "Compliance", "ManagedBy", "Repository"] as const;

export type DataClassification = "personal" | "confidential" | "public";

export function applyBaseTags(scope: IConstruct, stage: Stage) {
  const t = Tags.of(scope);
  t.add("Project", "plain-theory");
  t.add("Environment", stage);
  t.add("Owner", "platform-team");
  t.add("CostCenter", "plain-theory");
  t.add("Compliance", "dpdpa/gdpr/soc2"); // IAM tag values can't contain commas
  t.add("ManagedBy", "cdk");
  t.add("Repository", "gagankarthik/theplaintheory");
  // Safe default; stacks holding personal data raise it.
  t.add("DataClassification", "confidential");
}

export function tagComponent(scope: IConstruct, component: string, classification?: DataClassification) {
  Tags.of(scope).add("Component", component);
  if (classification) Tags.of(scope).add("DataClassification", classification, { priority: 200 });
}

/**
 * Fails synth when a taggable resource is missing a required tag, so untagged (and so unbilled,
 * unowned) resources can't reach an account. Runs after every tagging aspect (READONLY priority).
 */
class RequireTags implements IAspect {
  visit(node: IConstruct) {
    if (!(node instanceof CfnResource) || !TagManager.isTaggable(node)) return;
    const present = new Set(Object.keys(node.tags.tagValues()));
    const missing = REQUIRED_TAGS.filter((k) => !present.has(k));
    if (missing.length) Annotations.of(node).addError(`Missing required tags: ${missing.join(", ")}`);
  }
}

export function enforceTags(scope: IConstruct) {
  Aspects.of(scope).add(new RequireTags(), { priority: AspectPriority.READONLY });
}
