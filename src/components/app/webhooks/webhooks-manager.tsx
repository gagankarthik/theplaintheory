"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { createWebhook, deleteWebhook, setWebhookActive, testWebhook, type CreateWebhookState } from "@/app/app/sites/[propertyId]/webhooks/actions";
import { IconPlug, IconPlus } from "@/components/icons";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { Checkbox } from "@/components/app/ui/checkbox";
import { ConfirmDialog } from "@/components/app/ui/confirm-dialog";
import { CopyButton } from "@/components/app/ui/copy-button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { DateText } from "@/components/app/ui/date-text";
import { Dialog } from "@/components/app/ui/dialog";
import { EmptyState } from "@/components/app/ui/empty-state";
import { TextField } from "@/components/app/ui/field";
import { ResourceList } from "@/components/app/ui/resource-list";
import { SubmitButton } from "@/components/app/ui/submit-button";
import { FormMessage, useToast } from "@/components/app/ui/toast";
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
const EVENT_LABEL = Object.fromEntries(EVENTS.map((e) => [e.id, e.label])) as Record<WebhookEvent, string>;

function CreateForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [state, action] = useActionState<CreateWebhookState, FormData>(createWebhook.bind(null, propertyId), null);
  const fe = state?.fieldErrors ?? {};
  const toast = useToast();
  const secret = state?.secret;
  useEffect(() => {
    if (secret) toast("Webhook added.");
  }, [secret, toast]);

  if (secret) {
    return (
      <div className="space-y-5">
        <Alert tone="warning" title="Copy the signing secret now">
          It won&apos;t be shown again. Keep it in your server&apos;s secrets and use it to check the X-Plain-Signature header.
        </Alert>
        <div>
          <p className="label" id="secret-label">
            Signing secret
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <code aria-labelledby="secret-label" className="min-w-0 flex-1 break-all rounded-md border border-line bg-canvas px-3 py-2.5 font-mono text-xs text-ink">
              {secret}
            </code>
            <CopyButton value={secret} label="Copy" describedBy="secret-label" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <TextField
        id="wh-url"
        name="url"
        type="url"
        label="Endpoint URL"
        placeholder="https://example.com/hooks/consent"
        defaultValue={state?.url}
        error={fe.url}
        required
        spellCheck={false}
        controlClassName="font-mono"
        hint="Must be https. Every request is signed and retried up to 3 times."
      />
      <fieldset aria-describedby={fe.events ? "wh-events-error" : undefined} aria-invalid={fe.events ? true : undefined}>
        <legend className="label">Events</legend>
        <div className="space-y-3">
          {EVENTS.map((e) => (
            <Checkbox key={e.id} id={`wh-ev-${e.id}`} name="events" value={e.id} defaultChecked={e.id === "consent.withdrawn"} label={e.label} description={e.description} />
          ))}
        </div>
        {fe.events ? (
          <p id="wh-events-error" className="mt-2 text-xs font-medium text-destructive">
            {fe.events[0]}
          </p>
        ) : null}
      </fieldset>
      {state?.error && !state.fieldErrors ? <FormMessage state={{ error: state.error }} /> : null}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>
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
  /** the last row action that failed, shown inline above the list */
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const toast = useToast();
  const urlOf = (id: string) => webhooks.find((w) => w.id === id)?.url ?? "Deleted webhook";
  const failedUrl = rowError ? urlOf(rowError.id) : "";

  const deliveryColumns: Column<WebhookDelivery>[] = [
    { id: "event", header: "Event", cell: (d) => <span className="font-mono text-xs text-ink">{d.event}</span> },
    {
      id: "endpoint",
      header: "Endpoint",
      className: "max-w-[260px]",
      cell: (d) => (
        <span className="block truncate font-mono text-xs text-ink-2" title={urlOf(d.webhookId)}>
          {urlOf(d.webhookId)}
        </span>
      ),
    },
    {
      id: "result",
      header: "Result",
      sortValue: (d) => d.status,
      cell: (d) =>
        d.status === "delivered" ? (
          <Badge tone="success">{d.httpStatus ?? 200} delivered</Badge>
        ) : (
          <Badge tone="danger">{d.httpStatus ? `${d.httpStatus} failed` : "No response"}</Badge>
        ),
    },
    { id: "attempt", header: "Attempt", numeric: true, cell: (d) => d.attempt },
    { id: "duration", header: "Duration", numeric: true, sortValue: (d) => d.durationMs, cell: (d) => `${d.durationMs} ms` },
    { id: "time", header: "Sent", numeric: true, sortValue: (d) => d.createdAt, cell: (d) => <DateText iso={d.createdAt} mode="datetime" className="whitespace-nowrap text-ink-2" /> },
  ];

  const addButton = canWrite ? (
    <Button size="sm" onClick={() => setCreating(true)}>
      <IconPlus size={16} aria-hidden /> Add webhook
    </Button>
  ) : null;

  return (
    <div className="space-y-8">
      <section aria-label="Endpoints" className="space-y-3">
        {rowError ? (
          <Alert tone="danger" title={failedUrl}>
            {rowError.message}
          </Alert>
        ) : null}
        <ResourceList
          title="Endpoints"
          titleId="hooks-h"
          label="Webhook endpoints"
          actions={webhooks.length ? addButton : null}
          empty={
            <EmptyState
              bare
              headingLevel={3}
              icon={<IconPlug size={24} />}
              title="Send consent changes to your systems"
              action={
                canWrite ? (
                  <Button onClick={() => setCreating(true)}>
                    <IconPlus size={16} aria-hidden /> Add webhook
                  </Button>
                ) : undefined
              }
            >
              When someone withdraws consent, your CRM, CDP or warehouse hears about it, signed so it can trust the message.
            </EmptyState>
          }
          rows={webhooks.map((w) => ({
            id: w.id,
            title: (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-xs" title={w.url}>
                  {w.url}
                </span>
                {w.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Paused</Badge>}
              </span>
            ),
            meta: (
              <>
                {w.events.map((e) => EVENT_LABEL[e] ?? e).join(", ")} · Added <DateText iso={w.createdAt} />
              </>
            ),
            trailing: canWrite ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={testing === w.id}
                  loadingLabel="Sending"
                  disabled={pending || !w.active}
                  title={w.active ? undefined : "Resume the webhook to send a test"}
                  onClick={() => {
                    setTesting(w.id);
                    setRowError(null);
                    start(async () => {
                      const r = await testWebhook(propertyId, w.id);
                      setTesting(null);
                      if (r.error) setRowError({ id: w.id, message: r.error });
                      else if (r.ok) toast(`Test delivered (HTTP ${r.delivery?.httpStatus}) in ${r.delivery?.durationMs} ms.`);
                      else
                        setRowError({
                          id: w.id,
                          message: `Test failed${r.delivery?.httpStatus ? ` with HTTP ${r.delivery.httpStatus}` : ": the endpoint didn't respond"}. Check the URL and that it returns 2xx.`,
                        });
                    });
                  }}
                >
                  Send test
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setRowError(null);
                    start(async () => {
                      const r = await setWebhookActive(propertyId, w.id, !w.active);
                      if (r?.error) setRowError({ id: w.id, message: r.error });
                      else if (r?.ok) toast(r.ok);
                    });
                  }}
                >
                  {w.active ? "Pause" : "Resume"}
                </Button>
                <Button size="sm" variant="danger-quiet" disabled={pending} onClick={() => setConfirmDelete(w)} aria-label={`Delete webhook ${w.url}`}>
                  Delete
                </Button>
              </div>
            ) : undefined,
          }))}
        />
      </section>

      <section aria-labelledby="deliveries-h">
        <div className="mb-3">
          <h2 id="deliveries-h" className="text-base font-semibold">
            Recent deliveries
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">The newest 50 attempts, including retries. Kept 30 days.</p>
        </div>
        {deliveries.length === 0 ? (
          <EmptyState headingLevel={3} title="No deliveries yet">
            {webhooks.length ? "Send a test from an endpoint above to see one here." : "Deliveries appear here once an endpoint is added."}
          </EmptyState>
        ) : (
          <DataTable caption="Recent webhook deliveries" rows={deliveries} rowKey={(d) => d.id} columns={deliveryColumns} minWidth={760} maxHeight="min(60dvh, 560px)" />
        )}
      </section>

      <Card aria-labelledby="verify-h">
        <CardHeader
          titleId="verify-h"
          title="Verify signatures"
          description={
            <>
              Each request carries <code className="font-mono text-xs text-ink-2">X-Plain-Signature</code>, an HMAC-SHA256 of <code className="font-mono text-xs text-ink-2">t.body</code>. Reject
              requests older than five minutes and dedupe on <code className="font-mono text-xs text-ink-2">X-Plain-Delivery</code>.{" "}
              <Link href="/docs#webhooks" className="font-medium text-ink underline underline-offset-2 hover:no-underline">
                API docs
              </Link>
            </>
          }
          actions={<CopyButton value={VERIFY_SNIPPET} label="Copy code" />}
        />
        <CardBody flush>
          <pre tabIndex={0} aria-label="verify-plain-signature.js" className="scroll-thin overflow-x-auto rounded-b-lg bg-canvas px-5 py-4 font-mono text-xs leading-relaxed text-ink sm:px-6">
            <code>{VERIFY_SNIPPET}</code>
          </pre>
        </CardBody>
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Add webhook" description="Signed JSON is sent to this URL when the events you choose happen." width={560}>
        {creating ? <CreateForm propertyId={propertyId} onDone={() => setCreating(false)} /> : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this webhook?"
        description={
          <>
            <span className="block break-all font-mono text-xs text-ink">{confirmDelete?.url}</span>
            <span className="mt-2 block">Events stop immediately. Systems that rely on withdrawal notices won&apos;t hear about new ones.</span>
          </>
        }
        confirmLabel="Delete webhook"
        pendingLabel="Deleting"
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          const r = await deleteWebhook(propertyId, confirmDelete.id);
          if (r?.error) return { error: r.error };
          if (r?.ok) toast(r.ok);
        }}
      />
    </div>
  );
}
