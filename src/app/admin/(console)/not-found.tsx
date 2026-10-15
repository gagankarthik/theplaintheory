import { ButtonLink } from "@/components/app/ui/button";

/** Only reachable by staff (others are sent to /admin/login): a missing record, or a page their role can't open. */
export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 sm:text-center">
      <h1 className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">This page isn&apos;t available</h1>
      <p className="mt-2 text-sm text-ink-2">The record may have been deleted, the link may be wrong, or your staff role can&apos;t open this page. Search the lists instead.</p>
      <div className="mt-6 flex flex-wrap gap-2 sm:justify-center">
        <ButtonLink href="/admin/orgs">Organizations</ButtonLink>
        <ButtonLink variant="secondary" href="/admin/users">
          Users
        </ButtonLink>
      </div>
    </div>
  );
}
