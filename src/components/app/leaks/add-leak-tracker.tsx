"use client";

import { useState, useTransition } from "react";
import { addScannedTrackers } from "@/app/app/sites/[propertyId]/actions";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/app/ui/button";
import { useToast } from "@/components/app/ui/toast";
import type { CategoryId } from "@/lib/types";

/** One-click fix for an unknown tracker: hold its host under the category the visitor declined. */
export function AddLeakTracker({ propertyId, host, category }: { propertyId: string; host: string; category: CategoryId }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  if (category === "essential") return null;
  if (done)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <IconCheck size={14} aria-hidden /> Held from next publish
      </span>
    );
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        loadingLabel="Adding"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await addScannedTrackers(propertyId, [{ name: host, category, pattern: host }]);
            if (r?.error) setError(r.error);
            else {
              setDone(true);
              toast(`${host} will be held until visitors allow ${category}. Publish to apply it.`);
            }
          })
        }
      >
        Add as {category} tracker
      </Button>
      {error ? (
        <span role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
