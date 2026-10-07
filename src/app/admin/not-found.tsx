import { ButtonLink } from "@/components/app/ui/button";

/** Only reachable by staff (non-staff are stopped by the layout): a record that doesn't exist. */
export default function AdminNotFound() {
  return (
    <div className="max-w-xl py-10">
      <h1 className="text-xl font-bold">No record with that id</h1>
      <p className="mt-2 text-base text-ink-2">It may have been deleted, or the link is wrong. Search the lists instead.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/admin/orgs">Organizations</ButtonLink>
        <ButtonLink variant="ghost" href="/admin/users">
          Users
        </ButtonLink>
      </div>
    </div>
  );
}
