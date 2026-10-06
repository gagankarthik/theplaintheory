"use client";

import { useTransition } from "react";
import { publishSite } from "@/app/app/sites/[propertyId]/actions";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/app/ui/button";
import { useToast } from "@/components/app/ui/toast";

export function PublishButton({ propertyId, dirty }: { propertyId: string; dirty: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant={dirty ? "primary" : "ghost"}
      loading={pending}
      loadingLabel="Publishing"
      disabled={!dirty}
      title={dirty ? "Send the latest saved version to your site" : "Everything saved is already live"}
      onClick={() =>
        start(async () => {
          const r = await publishSite(propertyId);
          if (r?.error) toast(r.error, "error");
          else if (r?.ok) toast(r.ok);
        })
      }
    >
      {!dirty ? <IconCheck size={18} /> : null}
      {dirty ? "Publish" : "Published"}
    </Button>
  );
}
