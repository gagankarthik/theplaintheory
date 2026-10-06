"use client";

import { useActionState, useState } from "react";
import { createSite } from "@/app/app/actions";
import { type ActionResult } from "@/lib/action-result";
import { IconPlus } from "@/components/icons";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
import { FormMessage } from "@/components/app/ui/toast";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { TextField } from "@/components/app/ui/field";

export function AddSite({ atLimit, planName, limit }: { atLimit: boolean; planName: string; limit: number | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult, FormData>(createSite, null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus size={18} />
        Add site
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a site" description={atLimit ? undefined : "You'll get the install snippet right after."}>
        {atLimit ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              The {planName} plan includes {limit} site{limit === 1 ? "" : "s"}, and you&apos;re using all of them. Upgrade to add more.
            </p>
            <ButtonLink href="/app/billing" className="w-full">
              See plans
            </ButtonLink>
          </div>
        ) : (
          <form action={action} className="space-y-4" noValidate>
            <TextField id="site-name" name="name" label="Site name" required placeholder="Marketing site" autoFocus error={state?.fieldErrors?.name} />
            <TextField
              id="site-domain"
              name="domain"
              label="Domain"
              required
              placeholder="example.com"
              inputMode="url"
              autoCapitalize="none"
              hint="Without https://. Subdomains can share the same site key."
              error={state?.fieldErrors?.domain}
            />
            <FormMessage state={state && !state.fieldErrors ? state : null} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending="Adding site">Add site</SubmitButton>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
