import { DEFAULT_CATEGORIES } from "@/lib/defaults";

/** Static switch, drawn to match the real banner. */
function SwitchArt({ on }: { on: boolean }) {
  return (
    <span
      className={`relative block h-6 w-10 shrink-0 rounded-full ${on ? "bg-brand" : "bg-line-strong"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </span>
  );
}

function ButtonArt({
  children,
  primary,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <span
      className={`grid h-9 place-items-center rounded-[10px] text-[13px] font-medium ${
        primary
          ? "bg-brand text-white"
          : "text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Hero illustration: the preferences centre on top, the cookie banner below it and in front, both
 * straight. Static artwork (one image to assistive
 * tech); it stays still.
 */
export function HeroConsentStack() {
  const on: Record<string, boolean> = {
    essential: true,
    functional: true,
    analytics: true,
    marketing: false,
  };
  const card = "rounded-[20px] bg-white text-left ring-1 ring-ink/[0.07]";

  return (
    <figure
      data-hero-art
      className="relative mx-auto w-full max-w-[480px] select-none"
      aria-label="A Customise Consent Preferences panel with a cookie banner in front of it"
    >
      {/* Natural flow with a fixed overlap, so the pair looks the same at every screen height */}
      <div aria-hidden className="flex flex-col">
        {/* Back: preferences centre, no action buttons */}
        <div className="w-[88%]">
          <div className={`${card} shadow-[0_1px_2px_rgba(11,16,32,0.04)]`}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <span className="text-[15px] font-semibold tracking-tight">
                Customise Consent Preferences
              </span>
              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">
                GDPR
              </span>
            </div>
            <ul className="divide-y divide-line px-5 pb-7">
              {DEFAULT_CATEGORIES.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="text-sm font-medium">{c.label}</span>
                  {c.required ? (
                    <span className="rounded-full bg-jade-wash px-2.5 py-1 text-[11px] font-medium text-jade">
                      Always active
                    </span>
                  ) : (
                    <SwitchArt on={on[c.id]} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Front: the cookie banner, overlapping the last row slightly */}
        <div className="relative -mt-5 w-[88%] self-end">
          <div
            className={`${card} p-5 shadow-[0_1px_2px_rgba(11,16,32,0.05),0_24px_48px_-28px_rgba(11,16,32,0.22)]`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="text-[15px] font-semibold tracking-tight">
                Your choice about cookies
              </span>
              <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">
                GDPR notice
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              We use essential cookies to run this site. With your permission
              we&apos;d also use analytics and marketing cookies. You can change
              this any time.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ButtonArt>Reject all</ButtonArt>
              <ButtonArt>Customise</ButtonArt>
              <ButtonArt primary>Accept all</ButtonArt>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
