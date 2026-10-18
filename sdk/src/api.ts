/** Transport to the Plain Theory API. Fire-and-forget: consent UX must never wait on the network. */
export function createTransport(api: string, siteKey: string) {
  const beacon = (path: string, data: string) =>
    typeof navigator.sendBeacon === "function" && navigator.sendBeacon(`${api}${path}`, new Blob([data], { type: "text/plain" }));

  return {
    /**
     * Receipts: fetch keepalive (survives navigation), falling back to sendBeacon when the request
     * can't be sent. A busy or failing server (429, 5xx) is retried up to 3 times, about 2, 6 and 18
     * seconds apart with jitter, so a consent receipt is delayed rather than lost.
     */
    post(path: string, body: object): void {
      const data = JSON.stringify({ siteKey, ...body });
      const send = (attempt: number): void => {
        fetch(`${api}${path}`, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: data })
          .then((res) => {
            if ((res.status === 429 || res.status >= 500) && attempt < 3) setTimeout(() => send(attempt + 1), 2000 * 3 ** attempt * (0.75 + Math.random() / 2));
          })
          .catch(() => {
            if (attempt === 0) beacon(path, data);
          });
      };
      send(0);
    },
    /** Analytics events: sendBeacon only (no preflight, works on pagehide). */
    beacon(path: string, body: object): void {
      beacon(path, JSON.stringify({ siteKey, ...body }));
    },
  };
}

export type Transport = ReturnType<typeof createTransport>;
