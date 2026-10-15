/*
 * MOCK Meta Pixel (fbevents.js) — local test fixture for the Plain Theory demo site. Makes NO network requests to any vendor.
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

  setCookie("_fbp", "fb.1." + Date.now() + "." + Math.floor(Math.random() * 1e10), 90 * DAY);
  window.fbq = window.fbq || function () { (window.fbq.queue = window.fbq.queue || []).push(arguments); };
  window.fbq("init", "000000000000000");
  window.fbq("track", "PageView");

  window.__demoTrackers = window.__demoTrackers || {};
  window.__demoTrackers["meta-pixel"] = Date.now();
  window.dispatchEvent(new CustomEvent("demo:tracker-loaded", { detail: { id: "meta-pixel", category: "marketing" } }));
  console.info("[demo] Meta Pixel (fbevents.js) executed (marketing)");
})();
