import { IconExternal } from "@/components/icons";

/**
 * "Learn more" link to a section of the public docs. Opens in a new tab so unsaved work on the
 * page (banner drafts, region edits) is never lost; the icon and the hidden text say so.
 */
export function LearnMore({ anchor, topic, children = "Learn more" }: { anchor: string; topic: string; children?: React.ReactNode }) {
  return (
    <a
      href={`/docs#${anchor}`}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink"
    >
      {children}
      <span className="sr-only">
        {" "}
        about {topic} (opens in a new tab)
      </span>
      <IconExternal size={12} aria-hidden />
    </a>
  );
}
