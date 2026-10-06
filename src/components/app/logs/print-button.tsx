"use client";

import { Button } from "@/components/app/ui/button";
import { IconDownload } from "@/components/icons";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <IconDownload size={18} />
      Save as PDF
    </Button>
  );
}
