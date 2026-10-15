import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api", "/onboarding", "/preview-frame", "/demo", "/login", "/signup", "/forgot-password", "/reset-password"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
