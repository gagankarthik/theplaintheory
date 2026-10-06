import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export interface DeliveryStackProps extends StackProps {
  stage: string;
  /** e.g. cdn.theplaintheory.com; leave empty to use the *.cloudfront.net domain */
  cdnDomain?: string;
  /** ACM certificate in us-east-1 for cdnDomain */
  certificateArn?: string;
}

/**
 * The consent delivery engine: S3 (private) + CloudFront.
 *   /sdk/v1/plain-consent.js   immutable-ish SDK, long cache
 *   /c/<siteKey>.json          published banner config, 60 s cache + SWR, geo headers added at the edge
 * Target: < 50 ms global fetch and 99.99% availability (CloudFront + S3 origin, no compute in the hot path).
 */
export class DeliveryStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DeliveryStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "ConfigBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    const geoFn = new cloudfront.Function(this, "GeoHeaders", {
      code: cloudfront.FunctionCode.fromFile({ filePath: path.join(__dirname, "../functions/geo-headers.js") }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: "Adds x-plain-country / x-plain-region for region-aware banners",
    });

    const geoForward = new cloudfront.OriginRequestPolicy(this, "GeoForward", {
      comment: "Expose viewer geolocation headers to edge functions",
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        "CloudFront-Viewer-Country",
        "CloudFront-Viewer-Country-Region",
      ),
    });

    const configCache = new cloudfront.CachePolicy(this, "ConfigCache", {
      comment: "Banner config: short TTL, published changes visible within a minute (plus explicit invalidation)",
      defaultTtl: Duration.seconds(60),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.hours(24),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const sdkCors = new cloudfront.ResponseHeadersPolicy(this, "SdkHeaders", {
      corsBehavior: {
        accessControlAllowOrigins: ["*"],
        accessControlAllowMethods: ["GET", "HEAD"],
        accessControlAllowHeaders: ["*"],
        accessControlAllowCredentials: false,
        originOverride: true,
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
      },
    });

    const cert = props.certificateArn ? acm.Certificate.fromCertificateArn(this, "Cert", props.certificateArn) : undefined;

    this.distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: `Plain Theory consent delivery (${props.stage})`,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      // With a custom domain: TLS 1.2 minimum, TLS 1.3 negotiated with every client that supports it.
      minimumProtocolVersion: cert ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      domainNames: props.cdnDomain && cert ? [props.cdnDomain] : undefined,
      certificate: cert,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: sdkCors,
        compress: true,
      },
      additionalBehaviors: {
        "c/*": {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: configCache,
          originRequestPolicy: geoForward,
          compress: true,
          functionAssociations: [{ function: geoFn, eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE }],
        },
      },
    });

    // Ship the built SDK (run `npm run sdk:build` at the repo root first).
    new s3deploy.BucketDeployment(this, "Sdk", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../public/sdk"))],
      destinationBucket: this.bucket,
      destinationKeyPrefix: "sdk/v1/",
      cacheControl: [s3deploy.CacheControl.fromString("public, max-age=3600, stale-while-revalidate=604800")],
      distribution: this.distribution,
      distributionPaths: ["/sdk/v1/*"],
      prune: false,
    });

    new CfnOutput(this, "ConfigBucketName", { value: this.bucket.bucketName, description: "CONFIG_BUCKET" });
    new CfnOutput(this, "DistributionId", { value: this.distribution.distributionId, description: "CLOUDFRONT_DISTRIBUTION_ID" });
    new CfnOutput(this, "CdnUrl", {
      value: `https://${props.cdnDomain || this.distribution.distributionDomainName}`,
      description: "NEXT_PUBLIC_CDN_URL",
    });
  }
}
