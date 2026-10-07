import "server-only";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { cloudfrontClient, s3Client } from "./aws";
import type { PublicConfig } from "./public-config";
export { toPublicConfig, type PublicConfig } from "./public-config";

/**
 * PUBLISH_DRIVER=s3 writes c/<siteKey>.json to the config bucket and invalidates CloudFront.
 * Locally the config is served live by /api/v1/config/[siteKey], so publishing is a no-op.
 */
export async function publishConfig(cfg: PublicConfig) {
  if (process.env.PUBLISH_DRIVER !== "s3") return { location: `/api/v1/config/${cfg.siteKey}` };

  const key = `c/${cfg.siteKey}.json`;
  await s3Client().send(
    new PutObjectCommand({
      Bucket: process.env.CONFIG_BUCKET!,
      Key: key,
      Body: JSON.stringify(cfg),
      ContentType: "application/json",
      CacheControl: "public, max-age=60, stale-while-revalidate=86400",
    }),
  );
  if (process.env.CLOUDFRONT_DISTRIBUTION_ID) {
    await cloudfrontClient().send(
      new CreateInvalidationCommand({
        DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch: { CallerReference: `${cfg.siteKey}-${cfg.version}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/${key}`] } },
      }),
    );
  }
  return { location: `${process.env.NEXT_PUBLIC_CDN_URL ?? ""}/${key}` };
}
