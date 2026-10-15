/*
 * MOCK Google Analytics 4 (gtag.js) — local test fixture for the Plain Theory demo site. Makes NO network requests to any vendor.
 * Category: analytics. It only runs if the Plain Theory SDK releases it, and it records that it ran.
 */
(function () {
  "use strict";
  var DAY = 86400;
  function setCookie(name, value, maxAgeSeconds) {
    document.cookie = name + "=" + value + "; path=/; max-age=" + maxAgeSeconds + "; SameSite=Lax";
  }
  function rid(len) {
    var s = "";
    while (s.length < len) s += Math.floor(Math.random() * 1e9).toString(36);
    return s.slice(0, len);
  }

  var now = Math.floor(Date.now() / 1000);
  setCookie("_ga", "GA1.1." + Math.floor(Math.random() * 1e10) + "." + now, 400 * DAY);
  setCookie("_ga_DEMO1234", "GS2.1.s" + now + "$o1$g0$t" + now + "$j60$l0$h0", 400 * DAY);
  setCookie("_gid", "GA1.1." + Math.floor(Math.random() * 1e10) + "." + now, DAY);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-DEMO1234", { send_page_view: false });

  window.__demoTrackers = window.__demoTrackers || {};
  window.__demoTrackers["gtag"] = Date.now();
  window.dispatchEvent(new CustomEvent("demo:tracker-loaded", { detail: { id: "gtag", category: "analytics" } }));
  console.info("[demo] Google Analytics 4 (gtag.js) executed (analytics)");
})();
