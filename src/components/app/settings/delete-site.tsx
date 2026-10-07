"use client";

import { useId, useState, useTransition } from "react";
import { deleteSite } from "@/app/app/sites/[propertyId]/actions";
import { Button } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
import { FormMessage } from "@/components/app/ui/toast";
import { IconAlert, IconCheck, IconTrash } from "@/components/icons";
import type { ActionResult } from "@/lib/action-result";

export function DeleteSite({ propertyId, name, domain }: { propertyId: string; name: string; domain: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const matches = confirm.trim().toLowerCase() === domain;

  return (
    <>
      <Button variant="ghost" size="sm" className="!border-rose/40 !text-rose hover:!border-rose hover:!bg-rose-wash" onClick={() => setOpen(true)}>
        <IconTrash size={16} />
        Delete<span className="sr-only"> {name}</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete ${name}?`} description="This can't be undone." width={480}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setState(await deleteSite(propertyId, confirm)));
          }}
        >
          {/* 1. What happens */}
          <div className="rounded-[12px] border border-rose/30 bg-rose-wash/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose">
              <IconAlert size={16} /> Deleted for good
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2 marker:text-rose">
              <li>Banner settings, trackers and statistics</li>
              <li>Every consent receipt for {domain}</li>
              <li>The site key, so the banner stops recording consent</li>
            </ul>
            <p className="mt-3 text-xs text-ink-3">Export the consent log first if you need it, and remove the script tag from your site.</p>
          </div>

          {/* 2. What to type: the exact text is set apart from the instruction */}
          <div>
            <label htmlFor={`${id}-confirm`} className="block text-sm font-medium text-ink">
              To confirm, type the site&apos;s domain
            </label>
            <p id={`${id}-expect`} className="mt-2 flex items-center gap-2 text-sm text-ink-3">
              <span className="select-all rounded-[6px] border border-line bg-paper px-2 py-1 font-mono text-xs font-medium text-ink">{domain}</span>
            </p>
            <div className="relative mt-2">
              <input
                id={`${id}-confirm`}
                name="confirm"
                className={`field pr-10 font-mono ${matches ? "!border-rose" : ""}`}
                aria-describedby={`${id}-expect`}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {matches ? <IconCheck size={16} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-rose" /> : null}
            </div>
          </div>

          <FormMessage state={state} />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!matches} loading={pending} loadingLabel="Deleting">
              <IconTrash size={16} />
              Delete {name}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
