import { ImageResponse } from "next/og";
import { DEFAULT_KICKER, OG_SIZE, OgCard } from "@/lib/og-card";

export const alt = "Plain Theory: consent management for GDPR, CCPA and India's DPDPA";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(<OgCard title="Consent people understand. Proof auditors accept." kicker={DEFAULT_KICKER} />, size);
}
