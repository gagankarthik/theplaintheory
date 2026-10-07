import { ButtonLink } from "@/components/app/ui/button";

/** Only reachable by staff (others are sent to /admin/login): a missing record, or a page their role can't open. */
export default function AdminNotFound() {
  return (
    <div className="max-w-xl py-10">
      <h1 className="text-xl font-bold">This page isn&apos;t available</h1>
      <p className="mt-2 text-base text-ink-2">The record may have been deleted, the link may be wrong, or your staff role can&apos;t open this page. Search the lists instead.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/admin/orgs">Organizations</ButtonLink>
        <ButtonLink variant="ghost" href="/admin/users">
          Users
        </ButtonLink>
      </div>
    </div>
  );
}
