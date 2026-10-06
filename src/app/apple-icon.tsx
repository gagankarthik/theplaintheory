import { ImageResponse } from "next/og";
import { BRAND, MARK_PATH } from "@/components/brand/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Full-bleed tile: iOS applies its own corner mask, so we only supply the colour and the mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.ultramarine }}>
        <svg width="135" height="135" viewBox="0 0 24 24">
          <path d={MARK_PATH} fill="#fff" fillRule="evenodd" />
        </svg>
      </div>
    ),
    size,
  );
}
