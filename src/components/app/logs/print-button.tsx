"use client";

import { Button, type ButtonVariant } from "@/components/app/ui/button";
import { IconDownload } from "@/components/icons";

/** Opens the browser's print dialog, where the page can be saved as PDF. */
export function PrintButton({ variant = "secondary", label = "Save as PDF" }: { variant?: ButtonVariant; label?: string }) {
  return (
    <Button variant={variant} onClick={() => window.print()}>
      <IconDownload size={18} aria-hidden />
      {label}
    </Button>
  );
}
