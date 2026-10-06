"use client";

import { useState, useTransition } from "react";
import { deleteSite } from "@/app/app/sites/[propertyId]/actions";
import { Button } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
import { TextField } from "@/components/app/ui/field";
import { FormMessage } from "@/components/app/ui/toast";
import type { ActionResult } from "@/lib/action-result";

export function DeleteSite({ propertyId, name, domain }: { propertyId: string; name: string; domain: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const matches = confirm.trim().toLowerCase() === domain;

  return (
    <>
      <Button variant="ghost" size="sm" className="!border-rose/40 !text-rose hover:!border-rose" onClick={() => setOpen(true)}>
        Delete<span className="sr-only"> {name}</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete ${name}?`} description="The banner stops loading and its settings are removed. Consent receipts are kept for your retention period.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setState(await deleteSite(propertyId, confirm)));
          }}
        >
          <TextField
            id={`confirm-${propertyId}`}
            name="confirm"
            label={
              <>
                Type <span className="font-mono text-ink">{domain}</span> to confirm
              </>
            }
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FormMessage state={state} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!matches} loading={pending} loadingLabel="Deleting">
              Delete site
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
