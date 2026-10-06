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
  const toast = useToast();
  if (category === "essential") return null;
  if (done)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-jade">
        <IconCheck size={14} /> Held from next publish
      </span>
    );
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      loadingLabel="Adding"
      onClick={() =>
        start(async () => {
          const r = await addScannedTrackers(propertyId, [{ name: host, category, pattern: host }]);
          if (r?.error) toast(r.error, "error");
          else {
            setDone(true);
            toast(`${host} will be held until visitors allow ${category}. Publish to apply it.`);
          }
        })
      }
    >
      Add as {category} tracker
    </Button>
  );
}
