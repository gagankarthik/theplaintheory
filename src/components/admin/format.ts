// Formatting shared by console pages and client components. Fixed locale so server and client agree.

export const fmtInt = (n: number) => n.toLocaleString("en-US");
export const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Never");

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "Never";

export const fmtDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const REGION_LABEL: Record<string, string> = {
  "ap-south-1": "India (Mumbai)",
  "ap-south-2": "India (Hyderabad)",
  "eu-central-1": "EU (Frankfurt)",
  "us-east-1": "US (Virginia)",
};

/** Short device description from a user agent, for session lists. */
export function describeAgent(ua: string) {
  if (!ua || ua === "system") return "Internal tool";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}
