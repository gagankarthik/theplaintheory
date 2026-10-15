/*
 * MOCK dynamically injected marketing tag — local test fixture for the Plain Theory demo site. Makes NO network requests to any vendor.
 * Category: marketing. It only runs if the Plain Theory SDK releases it, and it records that it ran.
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

  setCookie("_demo_dyn_ad", rid(12), 30 * DAY);

  window.__demoTrackers = window.__demoTrackers || {};
  window.__demoTrackers["dynamic-marketing"] = Date.now();
  window.dispatchEvent(new CustomEvent("demo:tracker-loaded", { detail: { id: "dynamic-marketing", category: "marketing" } }));
  console.info("[demo] dynamically injected marketing tag executed (marketing)");
})();
