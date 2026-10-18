import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private surfaces only. Sign-in and sign-up stay crawlable so Google can read their noindex;
      // blocked here, they could still be listed as bare URLs.
      disallow: ["/app", "/admin", "/api", "/onboarding", "/preview-frame", "/demo", "/suspended"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
