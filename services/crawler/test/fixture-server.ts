import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface Fixture {
  siteUrl: string;
  trackerOrigin: string;
  close(): Promise<void>;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));
}

/**
 * Two local origins: a "site" on localhost:<port> and a "tracker" on 127.0.0.1:<port> (a different
 * registrable host, so it counts as third-party). No public internet involved.
 */
export async function startFixture(): Promise<Fixture> {
  let trackerOrigin = "";

  const tracker = createServer((req, res) => {
    if (req.url?.startsWith("/tr")) {
      res.writeHead(200, {
        "content-type": "image/gif",
        "set-cookie": ["_fbp=fb.1.1760000000.123; Max-Age=7776000; Path=/; SameSite=Lax"],
        "cache-control": "no-store",
      });
      res.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
      return;
    }
    res.writeHead(404).end();
  });

  const page = (title: string, body: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

  const site = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /blocked\n");
      return;
    }
    if (path === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "set-cookie": ["sessionid=s3cr3t; Path=/; HttpOnly; SameSite=Lax", "srv_lang=en; Max-Age=86400; Path=/"],
      });
      res.end(
        page(
          "Fixture home",
          `<h1>Home</h1>
           <a href="/second?utm_source=newsletter">Second</a>
           <a href="/blocked">Blocked</a>
           <a href="mailto:hi@fixture.test">Mail</a>
           <a href="https://external.example/">External</a>
           <img src="${trackerOrigin}/tr?id=42" width="1" height="1" alt="">
           <script>
             document.cookie = "_ga=GA1.1.123456.1760000000; max-age=63072000; path=/";
             localStorage.setItem("_hjSession_1", JSON.stringify({ id: "abc" }));
             sessionStorage.setItem("ajs_anonymous_id", "anon-1");
           </script>`,
        ),
      );
      return;
    }
    if (path === "/second") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "set-cookie": "cart_id=c-77; Path=/; Max-Age=3600" });
      res.end(page("Second", `<h1>Second</h1><a href="/">Home</a>`));
      return;
    }
    if (path === "/blocked") {
      res.writeHead(200, { "content-type": "text/html", "set-cookie": "should_not_appear=1; Path=/" });
      res.end(page("Blocked", "nope"));
      return;
    }
    res.writeHead(404, { "content-type": "text/html" }).end(page("Not found", "404"));
  });

  const trackerPort = await listen(tracker);
  trackerOrigin = `http://127.0.0.1:${trackerPort}`;
  const sitePort = await listen(site);

  return {
    siteUrl: `http://localhost:${sitePort}/`,
    trackerOrigin,
    close: async () => {
      await new Promise<void>((r) => site.close(() => r()));
      await new Promise<void>((r) => tracker.close(() => r()));
    },
  };
}
