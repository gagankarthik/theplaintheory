/*
 * Demo page helpers: the "Cookie settings" buttons, a live list of which mock trackers ran, and the
 * consent state. Uses Plain Theory's public API (window.PlainConsent) and nothing else.
 */
(function () {
  "use strict";
  var pc = window.PlainConsent && typeof window.PlainConsent.get === "function" ? window.PlainConsent : null;

  document.querySelectorAll("[data-open-settings]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (pc) pc.open();
      else button.textContent = "plain-consent.js did not load";
    });
  });
  document.querySelectorAll("[data-reset-consent]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (pc) pc.revoke();
      location.reload();
    });
  });

  var list = document.getElementById("ran");
  var state = document.getElementById("state");
  function render() {
    if (list) {
      var ran = Object.keys(window.__demoTrackers || {});
      list.innerHTML = "";
      (ran.length ? ran : ["none yet"]).forEach(function (name) {
        var li = document.createElement("li");
        li.textContent = name;
        list.appendChild(li);
      });
    }
    if (state) {
      var s = pc ? pc.get() : null;
      state.textContent = !pc ? "SDK not loaded" : s && s.decided ? JSON.stringify(s.categories) : "no decision yet";
    }
    var embed = document.querySelector(".embed iframe");
    var note = document.querySelector(".embed p");
    if (embed && note) note.hidden = Boolean(embed.getAttribute("src"));
  }
  window.addEventListener("demo:tracker-loaded", render);
  window.addEventListener("plainconsent:change", render);
  render();
})();
