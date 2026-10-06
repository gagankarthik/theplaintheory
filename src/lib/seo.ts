import type { Metadata } from "next";
import { site } from "./site";

/**
 * Metadata for one public page: title, a description kept within what search results show
 * (about 160 characters), its canonical URL, and a social card generated with the page's own title.
 * Setting openGraph on a page replaces the inherited object, so the image is always included here.
 */
export function pageMetadata({
  title,
  description,
  path,
  socialTitle = title,
  kicker,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  /** headline on the social card when it should differ from the <title> */
  socialTitle?: string;
  kicker?: string;
  index?: boolean;
}): Metadata {
  if (process.env.NODE_ENV !== "production" && description.length > 160) {
    console.warn(`[seo] ${path}: description is ${description.length} characters; search results show about 160.`);
  }
  const og = `/og?${new URLSearchParams({ title: socialTitle, ...(kicker ? { kicker } : {}) })}`;
  const image = { url: og, width: 1200, height: 630, alt: `${socialTitle} | ${site.name}` };
  const fullTitle = `${title} | ${site.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, siteName: site.name, title: fullTitle, description, images: [image] },
    twitter: { card: "summary_large_image", site: site.twitter, title: fullTitle, description, images: [image.url] },
    ...(index ? {} : { robots: { index: false, follow: false } }),
  };
}
