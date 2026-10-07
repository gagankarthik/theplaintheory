"use client";

import { useState, useTransition } from "react";
import { verifyReceiptAction, type ReceiptCheck } from "@/app/app/sites/[propertyId]/logs/[receiptId]/actions";
import { Button } from "@/components/app/ui/button";
import { IconAlert, IconCheck, IconShieldCheck } from "@/components/icons";
import { formatInt } from "@/lib/analytics";
import { utcLong } from "./receipt-labels";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${ok ? "text-jade" : "text-rose"}`}>{ok ? <IconCheck size={16} /> : <IconAlert size={16} />}</span>
      <span>
        <span className="sr-only">{ok ? "Pass: " : "Fail: "}</span>
        {children}
      </span>
    </li>
  );
}

/**
 * "Verify this receipt": recompute the receipt's hash from its stored fields and check both chain
 * links. The first result is computed on the server when the page renders, so a printed copy
 * carries it; the button runs the check again against what is stored now.
 */
export function ReceiptVerify({ propertyId, seq, initial }: { propertyId: string; seq: number; initial: ReceiptCheck }) {
  const [check, setCheck] = useState(initial);
  const [pending, start] = useTransition();
  const v = check.verification;
  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite" className="flex flex-col gap-3">
        {v ? (
          <>
            <p className={`flex items-center gap-2 text-sm font-semibold ${v.ok ? "text-jade" : "text-rose"}`}>
              {v.ok ? <IconShieldCheck size={18} /> : <IconAlert size={18} />}
              {v.ok ? "Verified. This receipt is unchanged and sits in an unbroken chain." : "Verification failed. This receipt or its links don't match what was written."}
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-2">
              <Check ok={v.hashOk}>{v.hashOk ? "Hash recomputed from the stored fields matches." : "Hash recomputed from the stored fields does not match: a field was changed after it was written."}</Check>
              <Check ok={v.linkOk}>
                {v.linkedTo === "genesis"
                  ? v.linkOk
                    ? "First receipt: links to the start of the chain."
                    : "First receipt, but it doesn't link to the start of the chain."
                  : v.linkedTo === "checkpoint"
                    ? v.linkOk
                      ? `Links to the retention checkpoint (receipts up to #${formatInt(seq - 1)} expired under your retention period).`
                      : "Doesn't link to the retention checkpoint."
                    : v.linkedTo === "previous"
                      ? v.linkOk
                        ? `Links to receipt #${formatInt(seq - 1)}.`
                        : `Doesn't link to receipt #${formatInt(seq - 1)}: one of them was changed.`
                      : `Receipt #${formatInt(seq - 1)} is missing, so the link can't be confirmed. A removed record breaks the chain.`}
              </Check>
              {v.nextOk === null ? (
                <li className="flex items-start gap-2 text-ink-3">
                  <span className="mt-0.5 shrink-0">
                    <IconCheck size={16} className="opacity-0" />
                  </span>
                  Newest receipt: no later receipt links to it yet.
                </li>
              ) : (
                <Check ok={v.nextOk}>{v.nextOk ? `Receipt #${formatInt(seq + 1)} links back to this one.` : `Receipt #${formatInt(seq + 1)} doesn't link back to this one.`}</Check>
              )}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-rose">
            <IconAlert size={18} />
            {check.error}
          </p>
        )}
        <p className="text-xs text-ink-3">
          Checked <time dateTime={check.checkedAt}>{utcLong(check.checkedAt)}</time>
        </p>
      </div>
      <div className="print:hidden">
        <Button variant="ghost" size="sm" loading={pending} loadingLabel="Verifying" onClick={() => start(async () => setCheck(await verifyReceiptAction(propertyId, seq)))}>
          <IconShieldCheck size={16} />
          Verify this receipt
        </Button>
      </div>
    </div>
  );
}
