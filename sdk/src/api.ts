/** Transport to the Plain Theory API. Fire-and-forget: consent UX must never wait on the network. */
export function createTransport(api: string, siteKey: string) {
  const beacon = (path: string, data: string) =>
    typeof navigator.sendBeacon === "function" && navigator.sendBeacon(`${api}${path}`, new Blob([data], { type: "text/plain" }));

  return {
    /** Receipts: fetch keepalive (survives navigation), falling back to sendBeacon. */
    post(path: string, body: object): void {
      const data = JSON.stringify({ siteKey, ...body });
      fetch(`${api}${path}`, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: data }).catch(() =>
        beacon(path, data),
      );
    },
    /** Analytics events: sendBeacon only (no preflight, works on pagehide). */
    beacon(path: string, body: object): void {
      beacon(path, JSON.stringify({ siteKey, ...body }));
    },
  };
}

export type Transport = ReturnType<typeof createTransport>;
