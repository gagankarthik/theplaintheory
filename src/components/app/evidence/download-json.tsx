"use client";

import { IconDownload } from "@/components/icons";
import { Button } from "@/components/app/ui/button";

/** Saves the exact pack rendered on this page, so its digest matches the printed one. */
export function DownloadJson({ json, filename }: { json: string; filename: string }) {
  return (
    <Button
      variant="ghost"
      onClick={() => {
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <IconDownload size={16} /> Download JSON
    </Button>
  );
}
