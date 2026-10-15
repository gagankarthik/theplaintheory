/*
 * MOCK Microsoft Clarity — local test fixture for the Plain Theory demo site. Makes NO network requests to any vendor.
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

  setCookie("_clck", rid(10) + "|2|f0|0|1", 365 * DAY);
  setCookie("_clsk", rid(10) + "|" + Date.now() + "|1|1|demo.clarity.local/collect", DAY);
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };

  window.__demoTrackers = window.__demoTrackers || {};
  window.__demoTrackers["clarity"] = Date.now();
  window.dispatchEvent(new CustomEvent("demo:tracker-loaded", { detail: { id: "clarity", category: "analytics" } }));
  console.info("[demo] Microsoft Clarity executed (analytics)");
})();
