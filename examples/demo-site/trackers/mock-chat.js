/*
 * MOCK support chat widget (Intercom-style) — local test fixture for the Plain Theory demo site. Makes NO network requests to any vendor.
 * Category: functional. It only runs if the Plain Theory SDK releases it, and it records that it ran.
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

  try {
    localStorage.setItem("intercom.demo-widget", JSON.stringify({ visitor: rid(12), openedAt: null }));
  } catch (e) {}
  function mount() {
    if (document.querySelector(".chat-bubble")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chat-bubble";
    b.textContent = "Ask the workshop";
    b.addEventListener("click", function () {
      b.textContent = "Ruth usually replies within a day";
    });
    document.body.appendChild(b);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.__demoTrackers = window.__demoTrackers || {};
  window.__demoTrackers["chat"] = Date.now();
  window.dispatchEvent(new CustomEvent("demo:tracker-loaded", { detail: { id: "chat", category: "functional" } }));
  console.info("[demo] support chat widget (Intercom-style) executed (functional)");
})();
