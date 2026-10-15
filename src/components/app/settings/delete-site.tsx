"use client";

import { useState } from "react";
import { deleteSite } from "@/app/app/sites/[propertyId]/actions";
import { Button } from "@/components/app/ui/button";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { IconTrash } from "@/components/icons";

/** Delete a site after typing its domain. The action redirects to the sites list when it succeeds. */
export function DeleteSite({ propertyId, name, domain }: { propertyId: string; name: string; domain: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger-quiet" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconTrash size={16} aria-hidden />
        Delete<span className="sr-only"> {name}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${name}?`}
        description={
          <>
            Its banner settings, trackers, statistics, site key and every consent receipt for {domain} are deleted for good. Export the consent log first if you need it, then remove the
            script tag from your site.
          </>
        }
        confirmLabel="Delete site"
        pendingLabel="Deleting"
        destructive
        typeToConfirm={domain}
        onConfirm={async () => {
          const r = await deleteSite(propertyId, domain);
          if (r?.error) return { error: r.error };
        }}
      />
    </>
  );
}
