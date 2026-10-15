/*
 * MOCK Hotjar — local test fixture for the Plain Theory demo site. Makes NO network requests to any vendor.
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

  var user = JSON.stringify({ id: rid(16), created: Date.now(), existing: false });
  var session = JSON.stringify({ id: rid(16), c: Date.now(), s: 0, r: 0, sb: 0 });
  try {
    localStorage.setItem("_hjSessionUser_1234567", user);
    sessionStorage.setItem("_hjSession_1234567", session);
  } catch (e) {}
  setCookie("_hjSessionUser_1234567", btoa(user), 365 * DAY);

  window.__demoTrackers = window.__demoTrackers || {};
  window.__demoTrackers["hotjar"] = Date.now();
  window.dispatchEvent(new CustomEvent("demo:tracker-loaded", { detail: { id: "hotjar", category: "analytics" } }));
  console.info("[demo] Hotjar executed (analytics)");
})();
