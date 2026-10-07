import { sdkSizeLabel } from "@/lib/sdk-size";
import { NoticeExplorer } from "./notice-explorer";

/** What one installation covers, shown rather than listed: pick a visitor's location, see their notice. */
export function CoverageStrip() {
  return (
    <section aria-labelledby="coverage-title" className="relative overflow-hidden bg-paper py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <div className="container-page relative">
        <div className="pt-reveal grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="coverage-title" className="display text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:col-span-7">
            One installation covers every notice you need
          </h2>
          <p className="max-w-[46ch] text-lg text-ink-2 lg:col-span-5">
            The same {sdkSizeLabel()} script works out which law applies to each visitor, shows them the right notice in their language, and
            tells your tags what they may do.
          </p>
        </div>
        <div className="mt-12 md:mt-14">
          <NoticeExplorer sizeLabel={sdkSizeLabel()} />
        </div>
      </div>
    </section>
  );
}
