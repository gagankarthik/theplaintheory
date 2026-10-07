"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR code for an authenticator app's otpauth:// link. Drawn in the browser from the link itself,
 * so the secret never goes to an image service. Dark modules on white, with a quiet zone, so phone
 * cameras read it in any theme.
 */
export function TotpQr({ uri, size = 176, label = "QR code to scan with your authenticator app" }: { uri: string; size?: number; label?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#0b1020", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(null));
    return () => {
      live = false;
    };
  }, [uri]);

  return (
    <div
      role="img"
      aria-label={label}
      className="grid shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-white [&>svg]:size-full"
      style={{ width: size, height: size }}
      // the SVG is generated locally by the qrcode library from our own otpauth URI
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
