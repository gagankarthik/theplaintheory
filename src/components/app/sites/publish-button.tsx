"use client";

import { useTransition } from "react";
import { publishSite } from "@/app/app/sites/[propertyId]/actions";
import { IconCheck } from "@/components/icons";
import { Button, type ButtonSize } from "@/components/app/ui/button";
import { useToast } from "@/components/app/ui/toast";

export function PublishButton({ propertyId, dirty, size = "md" }: { propertyId: string; dirty: boolean; size?: ButtonSize }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant={dirty ? "primary" : "ghost"}
      size={size}
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
      {!dirty ? <IconCheck size={size === "sm" ? 16 : 18} /> : null}
      {dirty ? "Publish" : "Published"}
    </Button>
  );
}
