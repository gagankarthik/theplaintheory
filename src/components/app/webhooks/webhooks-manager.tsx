"use client";

import { useActionState, useState, useTransition } from "react";
import { createWebhook, deleteWebhook, setWebhookActive, testWebhook, type CreateWebhookState } from "@/app/app/sites/[propertyId]/webhooks/actions";
import { IconAlert, IconCheck, IconPlug, IconPlus } from "@/components/icons";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { CopyButton } from "@/components/app/ui/copy-button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { Dialog } from "@/components/app/ui/dialog";
import { EmptyState } from "@/components/app/ui/empty-state";
import { TextField } from "@/components/app/ui/field";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { useToast } from "@/components/app/ui/toast";
import type { WebhookDelivery, WebhookEvent } from "@/lib/types";

export interface WebhookRow {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

const EVENTS: { id: WebhookEvent; label: string; description: string }[] = [
  { id: "consent.withdrawn", label: "Consent withdrawn", description: "Someone revoked or narrowed their consent. Use it to stop processing downstream." },
  { id: "consent.created", label: "Consent recorded", description: "Every new decision, with the receipt hash." },
  { id: "leak.detected", label: "Leak detected", description: "A tracker fired after a visitor declined its category." },
];

function CreateForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [state, action] = useActionState<CreateWebhookState, FormData>(createWebhook.bind(null, propertyId), null);
  const fe = state?.fieldErrors ?? {};

  if (state?.secret) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-md bg-jade-wash px-3 py-2.5 text-sm text-jade">
          <IconCheck size={16} className="mt-0.5 shrink-0" />
          {state.ok}
        </p>
        <div>
          <p className="label" id="secret-label">
            Signing secret
          </p>
          <div className="flex items-center gap-2">
            <code aria-labelledby="secret-label" className="min-w-0 flex-1 break-all rounded-md bg-paper px-3 py-2.5 font-mono text-xs">
              {state.secret}
            </code>
            <CopyButton value={state.secret} />
          </div>
          <p className="mt-1.5 text-xs text-ink-3">Store it in your server&apos;s secrets. Use it to verify the X-Plain-Signature header on every request.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <TextField id="wh-url" name="url" type="url" label="Endpoint URL" placeholder="https://example.com/hooks/consent" defaultValue={state?.url} error={fe.url} required hint="Must be https. We sign every request and retry up to 3 times." />
      <fieldset aria-describedby={fe.events ? "wh-events-error" : undefined}>
        <legend className="label">Events</legend>
        <div className="space-y-2">
          {EVENTS.map((e) => (
            <label key={e.id} className="flex cursor-pointer gap-3 rounded-md border border-line p-3 hover:border-line-strong has-[:checked]:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
              <input type="checkbox" name="events" value={e.id} defaultChecked={e.id === "consent.withdrawn"} className="mt-0.5 size-4 accent-[var(--color-ink)]" />
              <span>
                <span className="block text-sm font-medium">{e.label}</span>
                <span className="block text-xs text-ink-3">{e.description}</span>
              </span>
            </label>
          ))}
        </div>
        {fe.events ? (
          <p id="wh-events-error" className="mt-1.5 text-xs font-bold text-rose">
            {fe.events[0]}
          </p>
        ) : null}
      </fieldset>
      {state?.error && !state.fieldErrors ? <p role="alert" className="rounded-md bg-rose-wash px-3 py-2.5 text-sm text-rose">{state.error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pending="Adding">Add webhook</SubmitButton>
      </div>
    </form>
  );
}

const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

// header: "t=1760000000,v1=<hex>"   body: the raw request body (before JSON.parse)
export function verifyPlainSignature(secret, header, body, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${body}\`).digest();
  const given = Buffer.from(parts.v1 ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}`;

export function WebhooksManager({ propertyId, webhooks, deliveries, canWrite }: { propertyId: string; webhooks: WebhookRow[]; deliveries: WebhookDelivery[]; canWrite: boolean }) {
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WebhookRow | null>(null);
  const [pending, start] = useTransition();
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();
  const urlOf = (id: string) => webhooks.find((w) => w.id === id)?.url ?? "Deleted webhook";
  const deliveryColumns: Column<WebhookDelivery>[] = [
    {
      id: "time",
      header: "Time (UTC)",
      cell: (d) => <span className="whitespace-nowrap tabular-nums text-ink-2 max-sm:font-medium max-sm:text-ink">{d.createdAt.replace("T", " ").slice(0, 19)}</span>,
    },
    { id: "event", header: "Event", cell: (d) => <span className="font-mono text-xs">{d.event}</span> },
    {
      id: "endpoint",
      header: "Endpoint",
      className: "max-w-[240px]",
      cell: (d) => (
        <span className="block truncate font-mono text-xs text-ink-2" title={urlOf(d.webhookId)}>
          {urlOf(d.webhookId)}
        </span>
      ),
    },
    {
      id: "result",
      header: "Result",
      cell: (d) =>
        d.status === "delivered" ? (
          <Badge tone="released">{d.httpStatus ?? 200} delivered</Badge>
        ) : (
          <Badge tone="declined">{d.httpStatus ? `${d.httpStatus} failed` : "No response"}</Badge>
        ),
    },
    { id: "attempt", header: "Attempt", align: "right", cell: (d) => d.attempt },
    { id: "duration", header: "Duration", align: "right", cell: (d) => `${d.durationMs} ms` },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="hooks-h">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="hooks-h" className="text-lg font-semibold">
            Endpoints
          </h2>
          {canWrite && webhooks.length ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <IconPlus size={14} /> Add webhook
            </Button>
          ) : null}
        </div>
        {webhooks.length === 0 ? (
          <EmptyState
            icon={<IconPlug size={28} />}
            title="Send consent changes to your systems"
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <IconPlus size={16} /> Add webhook
                </Button>
              ) : undefined
            }
          >
            When someone withdraws consent, your CRM, CDP or data warehouse should stop processing too. Webhooks tell them, signed so they can trust it.
          </EmptyState>
        ) : (
          <ul className="panel divide-y divide-line">
            {webhooks.map((w) => (
              <li key={w.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm">{w.url}</span>
                    {w.active ? <Badge tone="released">Active</Badge> : <Badge tone="neutral">Paused</Badge>}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {w.events.join(", ")}. Added {new Date(w.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}.
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={testing === w.id}
                      loadingLabel="Sending"
                      disabled={pending || !w.active}
                      onClick={() => {
                        setTesting(w.id);
                        start(async () => {
                          const r = await testWebhook(propertyId, w.id);
                          setTesting(null);
                          if (r.error) toast(r.error, "error");
                          else if (r.ok) toast(`Test delivered (HTTP ${r.delivery?.httpStatus}) in ${r.delivery?.durationMs} ms.`);
                          else toast(`Test failed${r.delivery?.httpStatus ? ` with HTTP ${r.delivery.httpStatus}` : ": the endpoint didn't respond"}. Check the URL and that it returns 2xx.`, "error");
                        });
                      }}
                    >
                      Send test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await setWebhookActive(propertyId, w.id, !w.active);
                          if (r?.error) toast(r.error, "error");
                          else if (r?.ok) toast(r.ok);
                        })
                      }
                    >
                      {w.active ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" variant="quiet" disabled={pending} onClick={() => setConfirmDelete(w)} aria-label={`Delete webhook ${w.url}`}>
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="deliveries-h">
        <h2 id="deliveries-h" className="mb-1 text-lg font-semibold">
          Recent deliveries
        </h2>
        <p className="mb-4 text-sm text-ink-3">Every attempt, including retries. Kept for 30 days.</p>
        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-sm text-ink-3">No deliveries yet. Send a test to see one here.</p>
        ) : (
          <DataTable
            caption="Recent webhook deliveries"
            rows={deliveries}
            rowKey={(d) => d.id}
            columns={deliveryColumns}
          />
        )}
      </section>

      <section aria-labelledby="verify-h">
        <h2 id="verify-h" className="mb-1 text-lg font-semibold">
          Verify signatures
        </h2>
        <p className="mb-4 max-w-[70ch] text-sm text-ink-3">
          Each request carries <code className="font-mono">X-Plain-Signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>, an HMAC-SHA256 of <code className="font-mono">t.body</code> with your secret.
          Reject requests older than five minutes and dedupe on <code className="font-mono">X-Plain-Delivery</code>.
        </p>
        <div className="overflow-hidden rounded-lg bg-ink">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/70">
            <span className="font-mono">verify-plain-signature.js</span>
            <span className="[&_button]:border-white/20 [&_button]:text-white">
              <CopyButton value={VERIFY_SNIPPET} />
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-white/90">
            <code>{VERIFY_SNIPPET}</code>
          </pre>
        </div>
      </section>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Add webhook" description="We'll POST signed JSON to this URL when the events you choose happen." width={560}>
        {creating ? <CreateForm propertyId={propertyId} onDone={() => setCreating(false)} /> : null}
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete this webhook?" description={confirmDelete?.url} width={480}>
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <IconAlert size={16} className="mt-0.5 shrink-0 text-rose" />
          Events stop immediately. Systems that rely on withdrawal notices won&apos;t hear about new ones.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={pending}
            loadingLabel="Deleting"
            onClick={() =>
              start(async () => {
                const r = await deleteWebhook(propertyId, confirmDelete!.id);
                if (r?.error) toast(r.error, "error");
                else if (r?.ok) toast(r.ok);
                setConfirmDelete(null);
              })
            }
          >
            Delete webhook
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
