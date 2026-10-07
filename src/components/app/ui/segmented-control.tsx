import Link from "next/link";

export interface SegmentedLink {
  href: string;
  label: string;
  current: boolean;
}

/**
 * A segmented control made of links, for choices that live in the URL (a date range, a view). The
 * chosen link has aria-current and ultramarine text. Server-safe; 44px touch targets on phones.
 * For an in-page choice with no URL, use Segmented from ./tabs (a radiogroup).
 */
export function SegmentedControl({ label, items, size = "md", className = "" }: { label: string; items: SegmentedLink[]; size?: "sm" | "md"; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-paper p-0.5">
        {items.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link
              href={i.href}
              scroll={false}
              aria-current={i.current ? "page" : undefined}
              className={`inline-flex items-center rounded-sm px-3 text-xs font-semibold transition-colors max-sm:h-11 ${size === "sm" ? "h-7" : "h-8"} ${
                i.current ? "bg-surface text-brand-ink shadow-sm ring-1 ring-line" : "text-ink-3 hover:bg-line hover:text-ink"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
