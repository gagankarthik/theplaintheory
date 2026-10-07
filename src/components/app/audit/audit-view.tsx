"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ui/toast";
import { verifyAuditTrail, type AuditChainCheck } from "@/app/app/audit/actions";
import { Button } from "@/components/app/ui/button";
import { IconChain } from "@/components/icons";

export interface AuditRow {
  seq: number;
  createdAt: string;
  actor: string;
  system: boolean;
  action: string;
  label: string;
  target: string;
  details: string;
  hash: string;
}

/** Same pattern as the consent log: a header button, the result as a toast, and the Chain tile refreshes. */
export function VerifyAuditChain() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      loading={pending}
      loadingLabel="Verifying"
      onClick={() =>
        start(async () => {
          const r: AuditChainCheck = await verifyAuditTrail();
          if (r.ok) toast(`Chain intact. All ${r.checked.toLocaleString("en-GB")} events link correctly; none were altered or removed.`);
          else if (r.error) toast(r.error, "error");
          else toast(`Chain broken at event #${r.brokenAt}. An event was changed or removed after it was written. Export the log and treat this as a security incident.`, "error");
          router.refresh();
        })
      }
    >
      <IconChain size={18} />
      Verify chain
    </Button>
  );
}
