/**
 * /demo — a plain-HTML "customer website" that embeds the real SDK exactly as a customer would:
 * first script in <head>, trackers marked type="text/plain". Served raw (not a React page) so nothing
 * runs before the SDK. Uses the real site set in NEXT_PUBLIC_DEMO_SITE_KEY (see lib/demo.ts).
 */
import { DEMO_SITE_KEY } from "@/lib/demo";

export const dynamic = "force-static";

const html = (siteKey: string) => /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Monsoon Tea Co. · Plain Theory SDK demo</title>
<script src="/sdk/plain-consent.js" data-site="${siteKey}" data-debug></script>
<script>
  window.__demo = [];
  window.__demoLog = function (msg, kind) {
    window.__demo.push({ t: new Date().toLocaleTimeString(), msg: msg, kind: kind || "ok" });
    window.dispatchEvent(new Event("demo:log"));
  };
</script>

<!-- Held until the visitor allows Analytics -->
<script type="text/plain" data-consent="analytics">
  console.log("[demo] analytics tag released");
  window.__demoLog("Analytics tag ran (data-consent=analytics)");
</script>
<!-- Held until the visitor allows Marketing -->
<script type="text/plain" data-consent="marketing">
  console.log("[demo] marketing tag released");
  window.__demoLog("Marketing pixel ran (data-consent=marketing)");
</script>
<!-- Held until the visitor allows Preferences -->
<script type="text/plain" data-consent="functional">
  window.__demoLog("Preferences widget ran (data-consent=functional)");
</script>

<style>
  :root { --ink:#1d2a24; --leaf:#2f6b4f; --cream:#f7f4ec; --line:#e2ddd0; }
  * { box-sizing: border-box; }
  body { margin:0; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--cream); }
  header { display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1px solid var(--line); background:#fff; }
  header b { font-size:18px; letter-spacing:-.01em; }
  header nav { display:flex; gap:18px; font-size:14px; }
  main { max-width:1100px; margin:0 auto; padding:32px 20px 160px; display:grid; gap:28px; grid-template-columns: 1fr; }
  @media (min-width: 900px) { main { grid-template-columns: 1.4fr 1fr; } }
  main > * { min-width:0; }
  @media (max-width: 480px) { header { padding:14px 16px; } header nav { gap:12px; } }
  h1 { font-size: clamp(28px, 4vw, 44px); line-height:1.08; margin:0 0 10px; letter-spacing:-.02em; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:14px; margin-top:22px; }
  .tea { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px; }
  .tea i { display:block; aspect-ratio: 4/3; border-radius:8px; margin-bottom:10px; }
  .panel { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px; align-self:start; position:sticky; top:16px; }
  .panel h2 { font-size:15px; margin:0 0 10px; }
  pre { background:#141b34; color:#e6e9f5; border-radius:10px; padding:12px; font-size:12.5px; overflow:auto; margin:0 0 14px; }
  .btns { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
  button, .chip { font: inherit; font-size:13.5px; font-weight:600; border-radius:8px; border:1.5px solid var(--ink); background:#fff; padding:7px 11px; cursor:pointer; color:var(--ink); text-decoration:none; }
  .chip.on { background: var(--ink); color:#fff; }
  ul.log { list-style:none; padding:0; margin:0; font-size:13px; display:grid; gap:6px; }
  ul.log li { padding:6px 8px; border-radius:6px; background:#eef6f1; }
  ul.log li.held { background:#fff2da; }
  small { color:#5b665f; }
</style>
</head>
<body>
<header><b>Monsoon Tea Co.</b><nav><span>Shop</span><span>Estates</span><span>Journal</span></nav></header>
<main>
  <section>
    <h1>Single-estate Darjeeling, picked this spring.</h1>
    <p>This is a fake shop used to test the Plain Theory consent script. The analytics, marketing and preferences tags on this page stay held until you choose. Watch the panel on the right.</p>
    <div class="grid">
      <div class="tea"><i style="background:#c9d8b6"></i>First flush<br><small>₹640 · 100 g</small></div>
      <div class="tea"><i style="background:#d8c3a0"></i>Second flush<br><small>₹720 · 100 g</small></div>
      <div class="tea"><i style="background:#b9c9cf"></i>Oolong<br><small>₹880 · 100 g</small></div>
      <div class="tea"><i style="background:#e0cdb9"></i>Masala chai<br><small>₹420 · 200 g</small></div>
    </div>
  </section>

  <aside class="panel" aria-label="Consent inspector">
    <h2>Visitor location</h2>
    <div class="btns" id="geo">
      <a class="chip" href="?plain_country=DE">Germany (GDPR)</a>
      <a class="chip" href="?plain_country=IN">India (DPDPA)</a>
      <a class="chip" href="?plain_country=US&plain_region=CA">California (CCPA)</a>
      <a class="chip" href="?plain_country=BR">Brazil (default)</a>
    </div>
    <h2>PlainConsent.get()</h2>
    <pre id="state">Loading…</pre>
    <div class="btns">
      <button id="open">Open preferences</button>
      <button id="revoke">Withdraw consent</button>
      <button id="pixel">Inject Meta Pixel</button>
      <button id="leak">Fire a pixel anyway (leak test)</button>
    </div>
    <h2>What ran</h2>
    <ul class="log" id="log"><li class="held">Nothing yet. Trackers are held.</li></ul>
  </aside>
</main>
<script>
  (function () {
    var q = new URLSearchParams(location.search).get("plain_country");
    document.querySelectorAll("#geo .chip").forEach(function (a) {
      if (q && a.getAttribute("href").indexOf("plain_country=" + q) > -1) a.classList.add("on");
    });
    function draw() {
      var pc = window.PlainConsent;
      document.getElementById("state").textContent = pc && pc.get ? JSON.stringify(pc.get(), null, 2) : "SDK not loaded";
      var held = document.querySelectorAll("script[type='text/plain'][data-consent], iframe[data-consent]").length;
      var items = window.__demo.map(function (e) { return '<li class="' + e.kind + '">' + e.t + " · " + e.msg + "</li>"; });
      items.unshift('<li class="held">' + held + " tag(s) still held</li>");
      document.getElementById("log").innerHTML = items.join("");
    }
    window.addEventListener("demo:log", draw);
    window.addEventListener("plainconsent:change", draw);
    (window.PlainConsent && window.PlainConsent.on) && window.PlainConsent.on("ready", draw);
    document.getElementById("open").onclick = function () { window.PlainConsent.open(); };
    document.getElementById("revoke").onclick = function () { window.PlainConsent.revoke(); window.__demoLog("Consent withdrawn. Reload to see tags held again.", "held"); };
    document.getElementById("pixel").onclick = function () {
      var s = document.createElement("script");
      s.src = "https://connect.facebook.net/demo/fbevents.js";
      s.onerror = function () { window.__demoLog("Meta Pixel requested from network (marketing allowed)"); };
      document.head.appendChild(s);
      setTimeout(function () {
        if (s.getAttribute("data-plain-src")) window.__demoLog("Meta Pixel held by the SDK (marketing not allowed)", "held");
        draw();
      }, 50);
    };
    // Leak test: an <img> pixel isn't held by the script (like a tag added outside it). If Marketing
    // is declined, the SDK's leak detection reports it to /api/v1/leak and the dashboard shows it.
    document.getElementById("leak").onclick = function () {
      var img = new Image(1, 1);
      img.alt = "";
      img.src = "https://connect.facebook.net/tr?id=demo&ev=PageView&noscript=1";
      document.body.appendChild(img);
      var allowed = window.PlainConsent.get().categories.marketing;
      window.__demoLog(allowed ? "Pixel fired with Marketing allowed: not a leak" : "Pixel fired after Marketing was declined: leak reported", allowed ? "ok" : "held");
    };
    setTimeout(draw, 300);
  })();
</script>
</body>
</html>`;

export function GET() {
  if (!DEMO_SITE_KEY) return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex, nofollow" } });
  return new Response(html(DEMO_SITE_KEY), {
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" },
  });
}
