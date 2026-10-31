/**
 * Script dock: the user's script buttons, floating over Odoo pages.
 *
 * The content script never runs the code itself. A click only sends the
 * script id to the service worker, which looks the code up in storage and
 * executes it in the page. A page cannot reach this message channel, so it
 * cannot make the extension run anything that was not saved by the user.
 */
(function (ns) {
  "use strict";

  const DOCK_ID = "ost-script-dock";
  const FLASH_MS = 1200;

  function wanted() {
    const { settings, scripts } = ns.state;
    return settings.enabled && settings.scriptDock && scripts.length > 0;
  }

  function signature() {
    return ns.state.scripts.map((s) => `${s.id}:${s.name}:${s.color}`).join("|");
  }

  function run(button, id) {
    chrome.runtime.sendMessage({ type: "ost:run-script", id }, (result) => {
      const ok = !chrome.runtime.lastError && result && result.ok;
      button.classList.add(ok ? "ost-ok" : "ost-err");
      setTimeout(() => button.classList.remove("ost-ok", "ost-err"), FLASH_MS);
    });
  }

  function build() {
    const dock = document.createElement("div");
    dock.id = DOCK_ID;
    dock.dataset.sig = signature();

    const handle = document.createElement("span");
    handle.className = "ost-dock-handle";
    handle.textContent = "</>";
    handle.setAttribute("aria-hidden", "true");

    const list = document.createElement("div");
    list.className = "ost-dock-list";
    for (const script of ns.state.scripts) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = script.name;
      button.title = script.name;
      button.style.setProperty("--c", script.color);
      button.addEventListener("click", () => run(button, script.id));
      list.append(button);
    }
    dock.append(handle, list);
    return dock;
  }

  function apply() {
    const existing = document.getElementById(DOCK_ID);
    if (!wanted() || !document.body) {
      remove();
      return;
    }
    if (existing && existing.dataset.sig === signature()) {
      return;
    }
    if (existing) {
      existing.remove();
    }
    document.body.append(build());
  }

  /** @returns {boolean} Whether a dock was removed. */
  function remove() {
    const existing = document.getElementById(DOCK_ID);
    if (existing) {
      existing.remove();
      return true;
    }
    return false;
  }

  ns.scriptDock = { apply, remove };
})(globalThis.OstContent);
