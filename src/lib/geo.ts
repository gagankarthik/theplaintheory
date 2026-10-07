import type { Framework } from "./types";

const EEA = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "),
);

/**
 * Map a viewer location to a legal framework. Country comes from the CloudFront
 * `CloudFront-Viewer-Country` header (or the CloudFront Function in infra/ that copies it into the config URL).
 */
export function frameworkFor(country?: string | null, region?: string | null): Framework {
  const c = (country ?? "").toUpperCase();
  if (EEA.has(c)) return "gdpr";
  if (c === "IN") return "dpdpa";
  if (c === "US" && (region ?? "").toUpperCase() === "CA") return "ccpa";
  return "generic";
}

/** Read country/region from whichever edge sets it. Falls back to ?country= for local testing. */
export function viewerLocation(headers: Headers, url?: URL) {
  const country =
    url?.searchParams.get("country") ??
    // The host's own header first: Vercel sets x-vercel-ip-country itself, while a client could send a
    // CloudFront header to a Vercel deployment and pick its own country.
    headers.get("x-vercel-ip-country") ??
    headers.get("cloudfront-viewer-country") ??
    headers.get("cf-ipcountry") ??
    "";
  const region =
    url?.searchParams.get("region") ??
    headers.get("x-vercel-ip-country-region") ??
    headers.get("cloudfront-viewer-country-region") ??
    "";
  return { country: country.toUpperCase() || "XX", region: region.toUpperCase() };
}

export function parseUserAgent(ua: string | null) {
  const s = ua ?? "";
  const device: "desktop" | "mobile" | "tablet" = /iPad|Tablet/i.test(s)
    ? "tablet"
    : /Mobi|Android|iPhone/i.test(s)
      ? "mobile"
      : "desktop";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\//.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : "Other";
  return { device, browser };
}
