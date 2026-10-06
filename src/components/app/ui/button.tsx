import Link from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "ghost" | "ink" | "danger" | "quiet";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  ink: "btn-ink",
  danger: "btn-danger",
  quiet: "text-ink-2 hover:bg-line hover:text-ink",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  // Small buttons grow to a 44px touch target on narrow screens.
  return `btn ${VARIANT[variant]} ${size === "sm" ? "btn-sm max-sm:h-11" : ""} ${className}`.trim();
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** text announced and shown while loading */
  loadingLabel?: string;
};

/** Button with variants and a loading state. Server-safe (no hooks). */
export function Button({ variant = "primary", size = "md", loading, loadingLabel, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
