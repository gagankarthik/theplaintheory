import { ButtonLink } from "@/components/app/ui/button";

export default function AppNotFound() {
  return (
    <div className="max-w-xl py-10">
      <p
        aria-hidden
        className="select-none bg-[linear-gradient(160deg,var(--color-brand-bright)_10%,var(--color-brand)_45%,var(--color-brand-deep)_100%)] bg-clip-text text-[clamp(4.5rem,22vw,7rem)] font-semibold leading-[0.85] tracking-[-0.06em] text-transparent tabular-nums"
      >
        404
      </p>
      <h1 className="mt-5 text-xl font-semibold">
        <span className="sr-only">404: </span>We couldn&apos;t find that
      </h1>
      <p className="mt-2 text-base text-ink-2">The site may have been deleted, or it belongs to an organization you&apos;re not a member of.</p>
      <ButtonLink className="mt-6" href="/app">
        Go to sites
      </ButtonLink>
    </div>
  );
}
