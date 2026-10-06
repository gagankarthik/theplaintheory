"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/** Submit button that reflects the enclosing form's pending state (React 19 useFormStatus). */
export function SubmitButton({
  children,
  pending: pendingLabel,
  variant = "primary",
  size,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pending?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={disabled} loading={pending} loadingLabel={pendingLabel}>
      {children}
    </Button>
  );
}
