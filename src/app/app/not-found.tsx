import { ButtonLink } from "@/components/app/ui/button";

export default function AppNotFound() {
  return (
    <div className="max-w-xl py-12 sm:py-16">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-3 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">We couldn&apos;t find that</h1>
      <p className="mt-2 text-sm text-ink-2">The site may have been deleted, or it belongs to an organization you&apos;re not a member of.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/app">Go to sites</ButtonLink>
        <ButtonLink href="/docs" variant="secondary">
          Read the docs
        </ButtonLink>
      </div>
    </div>
  );
}
