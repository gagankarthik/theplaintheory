import type { ComponentProps, ReactNode } from "react";

/**
 * The one card: hairline border, 16px radius, white surface, no shadow. Compose it from CardHeader,
 * CardBody and CardFooter. tone="danger" gives a rose edge and heading, for irreversible actions.
 *
 *   <Card aria-labelledby="usage-h">
 *     <CardHeader titleId="usage-h" title="Usage" description="…" actions={<Button …/>} />
 *     <CardBody>…</CardBody>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 */
export function Card({
  as: Tag = "section",
  tone = "default",
  className = "",
  children,
  ...rest
}: { as?: "section" | "div" | "article" | "li"; tone?: "default" | "danger"; className?: string; children: ReactNode } & Omit<ComponentProps<"section">, "className" | "children" | "ref">) {
  return (
    <Tag data-tone={tone} className={`group/card rounded-lg border bg-surface ${tone === "danger" ? "border-rose/40" : "border-line"} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** Title (an h2, or h3 with `level`), an optional description and actions on the right. */
export function CardHeader({
  title,
  titleId,
  description,
  actions,
  icon,
  level = 2,
  divider = true,
  className = "",
}: {
  title: ReactNode;
  /** id for the heading, so the Card can point aria-labelledby at it */
  titleId?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** small icon before the title */
  icon?: ReactNode;
  level?: 2 | 3;
  /** hairline under the header; turn off when the body follows straight on */
  divider?: boolean;
  className?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div
      className={`flex flex-col gap-3 rounded-t-lg px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
        divider ? "border-b border-line group-data-[tone=danger]/card:border-rose/25 group-data-[tone=danger]/card:bg-rose-wash/60" : ""
      } ${className}`}
    >
      <div className="min-w-0">
        <H id={titleId} className="flex items-center gap-2 text-base font-semibold text-ink group-data-[tone=danger]/card:text-rose">
          {icon}
          {title}
        </H>
        {description ? <div className="mt-0.5 max-w-prose text-sm text-ink-3">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Padded content area. `flush` drops the padding for lists and tables that run edge to edge. */
export function CardBody({ children, flush, className = "" }: { children: ReactNode; flush?: boolean; className?: string }) {
  return <div className={`${flush ? "" : "px-5 py-5 sm:px-6"} ${className}`}>{children}</div>;
}

/** Actions or a footnote along the bottom, on a paper band. */
export function CardFooter({ children, align = "end", className = "" }: { children: ReactNode; align?: "start" | "end" | "between"; className?: string }) {
  const justify = align === "start" ? "justify-start" : align === "between" ? "justify-between" : "justify-end";
  return <div className={`flex flex-wrap items-center gap-3 rounded-b-lg border-t border-line bg-paper/60 px-5 py-3.5 sm:px-6 ${justify} ${className}`}>{children}</div>;
}
