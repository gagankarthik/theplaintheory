import Link from "next/link";

/**
 * The close: one sentence with a blank. The blank is the email field, the last word is the button,
 * and the form opens sign-up with the address filled in.
 */
export function Closing() {
  return (
    <section aria-labelledby="close-title" className="bg-soot px-5 pb-16 pt-16 text-white sm:px-8 md:pb-24 md:pt-24">
      <form action="/signup" method="get" className="mx-auto max-w-[1440px]">
        {/* A wrapping row with real gaps, so the phrase, the field and the button never touch when they wrap. */}
        <h2 id="close-title" className="flex flex-wrap items-center gap-x-[0.3em] gap-y-[0.3em] text-[clamp(2.25rem,6.4vw,6.25rem)] leading-[1.1]">
          <span>Start free as</span>
          <label htmlFor="close-email" className="sr-only">
            Your work email
          </label>
          <input
            id="close-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            // Text at half the headline size (sizes below are in the field's own em): the pill keeps the
            // headline's height while an address, and the placeholder, fit in full.
            className="h-[2.4em] w-[14em] min-w-0 max-w-full rounded-full bg-soot-3 px-[0.9em] text-[0.5em] text-white placeholder:text-mute focus:outline-2 focus:outline-offset-2 focus:outline-lime max-md:w-full"
          />
          <button type="submit" aria-label="Create a free account" className="h-[1.2em] rounded-full bg-lime px-[0.5em] leading-none text-soot transition-colors duration-150 hover:bg-lime-deep">
            today
          </button>
        </h2>
        <p className="mt-10 max-w-[56ch] text-[1rem] leading-[1.5] text-mute">
          Opens sign-up with your email filled in. Your first site is free, with real blocking and a 90-day consent log. No card needed.
        </p>
        <p className="mt-3 text-[1rem] text-mute">
          Prefer a walkthrough?{" "}
          <Link href="/contact?topic=sales" className="font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Book a demo
          </Link>
        </p>
      </form>
    </section>
  );
}
