import { ButtonLink } from "@/components/app/ui/button";

export default function AppNotFound() {
  return (
    <div className="max-w-xl py-10">
      <h1 className="text-xl font-bold">We couldn&apos;t find that</h1>
      <p className="mt-2 text-base text-ink-2">The site may have been deleted, or it belongs to an organization you&apos;re not a member of.</p>
      <ButtonLink className="mt-6" href="/app">
        Go to sites
      </ButtonLink>
    </div>
  );
}
