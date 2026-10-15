import Link from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./spinner";

/**
 * Pill buttons ("stems", like the website).
 *
 *   primary       the view's one main action: soot with white text (light), lime with soot text (dark)
 *   secondary     every other action: an outline on the 3:1 boundary token
 *   ghost         older name for secondary, kept for existing callers (same style)
 *   quiet         borderless: toolbars, row actions, icon buttons
 *   danger        the confirm button of a destructive dialog (rose fill)
 *   danger-quiet  a row-level remove that turns rose on hover and focus
 *   link          an underlined text button for secondary actions in running text
 *
 * Sizes: sm 32px (44px on phones), md 40px, lg 48px.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger" | "danger-quiet" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  "danger-quiet": "btn-danger-quiet",
  quiet: "btn-quiet",
  link: "btn-link max-sm:min-h-11",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  // Small buttons grow to a 44px touch target on narrow screens. Text links size to their text.
  const sized = variant === "link" ? "" : size === "sm" ? "btn-sm max-sm:h-11" : size === "lg" ? "btn-lg" : "";
  return `btn ${VARIANT[variant]} ${sized} ${className}`.trim();
}

type Styling = { variant?: ButtonVariant; size?: ButtonSize };

type ButtonProps = ComponentProps<"button"> &
  Styling & {
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

/** A Next.js link that looks like a button: for navigation inside the app. */
export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & Styling) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/** A plain <a> that looks like a button: for downloads (`download`), mailto: and API routes. */
export function ButtonAnchor({ variant = "ghost", size = "md", className, ...rest }: ComponentProps<"a"> & Styling) {
  return <a className={buttonClass(variant, size, className)} {...rest} />;
}
