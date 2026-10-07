import Link from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./spinner";

/**
 * primary: the page's one main action (ultramarine). ghost: every other action. quiet: toolbar and
 * row actions. danger: the confirm button of a destructive dialog. danger-quiet: a row-level remove
 * that turns rose on hover and focus. link: a text button for secondary actions in running text.
 */
export type ButtonVariant = "primary" | "ghost" | "quiet" | "danger" | "danger-quiet" | "link";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  "danger-quiet": "btn-danger-quiet",
  quiet: "text-ink-2 hover:bg-line hover:text-ink",
  link: "btn-link max-sm:min-h-11",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  // Small buttons grow to a 44px touch target on narrow screens. Text links size to their text.
  const sized = variant !== "link" && size === "sm" ? "btn-sm max-sm:h-11" : "";
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
