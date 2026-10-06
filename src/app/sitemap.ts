import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/lib/marketing-routes";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_ROUTES.map((r) => ({
    url: absoluteUrl(r.path),
    lastModified: r.updated,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
