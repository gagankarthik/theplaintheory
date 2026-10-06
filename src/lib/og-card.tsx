import { BRAND, MARK_PATH } from "@/components/brand/logo";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * The social preview card (Open Graph / X). One design for every page: the lockup, the page title
 * set large, and a one-line kicker. Rendered by next/og, so only inline styles and flexbox.
 */
export function OgCard({ title, kicker }: { title: string; kicker: string }) {
  // Long titles step down so they never run past three lines.
  const size = title.length > 60 ? 64 : title.length > 38 ? 76 : 88;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        color: "white",
        background: `linear-gradient(180deg, ${BRAND.ultramarine} 0%, #15127a 100%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="52" height="52" viewBox="0 0 24 24">
          <path d={MARK_PATH} fill="#fff" fillRule="evenodd" />
        </svg>
        <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1.2 }}>Plain Theory</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.02, letterSpacing: -size * 0.04, maxWidth: 1000 }}>{title}</div>
        <div style={{ fontSize: 30, color: "#eeedff", letterSpacing: -0.4 }}>{kicker}</div>
      </div>
    </div>
  );
}

export const DEFAULT_KICKER = "GDPR, CCPA/CPRA and DPDPA from one script under 10 KB.";
