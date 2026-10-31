/**
 * Odoo.sh online editor (JupyterLab) integration: the "odoo-bin shell" menu
 * entry, quick commands in the file browser, and Ctrl+C as a real copy.
 *
 * Commands reach the terminal through page/editor-bridge.js, which runs in
 * the page's main world. The two sides talk over postMessage.
 */
(function (ns) {
  "use strict";

  const MENU_ITEM_CLASS = "ost-menu-item";
  // Entries appended to the JupyterLab menu bar, in display order.
  const MENU_ITEMS = [
    { key: "shell", label: "odoo-bin shell", command: "odoo-bin shell" },
    { key: "psql", label: "psql", command: "psql" },
  ];
  const BRIDGE_ID = "ost-editor-bridge";
  const CHANNEL_IN = "ost-editor-request";
  const CHANNEL_OUT = "ost-editor-response";
  const BRIDGE_TIMEOUT = 2000;

  ns.editor = { MENU_ITEM_CLASS };

  const MODULE_NAME_RE = /^[w.-]+$/;

  let bridgeSeq = 0;
  const bridgeWaiting = new Map();

  // Name and type (file/folder) of the entry last right-clicked in the file
  // browser. The menu itself carries no such information, so it is captured
  // from the original "contextmenu" event while the menu opens.
  let lastContextEntry = null;

  // ------------------------------------------------------------------
  // Detection
  // ------------------------------------------------------------------

  /**
   * The editor is recognised by the JupyterLab shell, not by URL: the path
   * differs between projects while these containers never do.
   */
  function editorPresent() {
    if (document.querySelector("#jp-main-dock-panel, .jp-LabShell, #jupyterlab-splash, [data-jp-theme-name]")) {
      return true;
    }
    // Fallback for the short window where the URL is already right but the
    // app has not mounted its containers yet.
    return /\/odoo-sh\/editor(\/|$)/i.test(window.location.pathname);
  }

  /** Foreground terminal. Hidden ones have no layout, hence the offsetParent check. */
  function visibleTerminal() {
    for (const node of document.querySelectorAll(".jp-Terminal")) {
      if (node.offsetParent !== null) {
        return node;
      }
    }
    return null;
  }

  /** Label of the active tab in the main area. Informational only. */
  function activeTabLabel() {
    const tab = document.querySelector(
      '.lm-TabBar-tab.lm-mod-current[aria-selected="true"] .lm-TabBar-tabLabel'
    );
    return tab ? tab.textContent.trim() : "";
  }

  // ------------------------------------------------------------------
  // Bridge client
  // ------------------------------------------------------------------

  function injectBridge() {
    if (document.getElementById(BRIDGE_ID)) {
      return;
    }
    const script = document.createElement("script");
    script.id = BRIDGE_ID;
    script.src = chrome.runtime.getURL("src/page/editor-bridge.js");
    // Keep the node after it loads: it is the only marker that the bridge is
    // already there. Removing it made this check fail and re-fetched the file
    // on every call.
    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.channel !== CHANNEL_OUT) {
      return;
    }
    const pending = bridgeWaiting.get(data.id);
    if (pending) {
      bridgeWaiting.delete(data.id);
      clearTimeout(pending.timer);
      pending.resolve(data);
    }
  });

  /**
   * Forwards a command to the bridge and waits for the result. The timeout
   * keeps the popup from hanging if the page script never answers.
   */
  function runInTerminal(command, newTerminal) {
    return new Promise((resolve) => {
      injectBridge();
      const id = "cmd" + ++bridgeSeq;
      const timer = setTimeout(() => {
        bridgeWaiting.delete(id);
        resolve({ ok: false, error: "editor did not answer" });
      }, BRIDGE_TIMEOUT);

      bridgeWaiting.set(id, { resolve, timer });
      window.postMessage(
        { channel: CHANNEL_IN, id: id, command: command, newTerminal: !!newTerminal },
        window.location.origin
      );
    });
  }

  // ------------------------------------------------------------------
  // "odoo-bin shell" menu entry
  // ------------------------------------------------------------------

  function buildMenuItem(entry) {
    const item = document.createElement("li");
    item.id = "ost-menu-" + entry.key;
    item.className = "lm-MenuBar-item " + MENU_ITEM_CLASS;
    item.setAttribute("role", "menuitem");
    item.title = "Open a terminal and run " + entry.command;

    const label = document.createElement("div");
    label.className = "lm-MenuBar-itemLabel";
    label.textContent = entry.label;
    item.appendChild(label);

    // Capture phase with propagation stopped: the Lumino menu bar handles its
    // own clicks and would open an empty menu in our place.
    item.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        runInTerminal(entry.command, true);
      },
      true
    );
    return item;
  }

  /**
   * Appends our entries after Help in the JupyterLab menu bar. The mutation
   * observer puts them back whenever Lumino redraws the bar, because those
   * nodes are not ours to manage.
   */
  function applyEditorMenu() {
    const { settings } = ns.state;
    const wanted = settings.enabled && settings.shellUi && editorPresent();

    if (!wanted) {
      for (const node of document.querySelectorAll("." + MENU_ITEM_CLASS)) {
        node.remove();
      }
      return;
    }
    const bar = document.querySelector("#jp-MainMenu .lm-MenuBar-content");
    if (!bar) {
      return;
    }
    for (const entry of MENU_ITEMS) {
      if (!document.getElementById("ost-menu-" + entry.key)) {
        bar.appendChild(buildMenuItem(entry));
      }
    }
  }

  // ------------------------------------------------------------------
  // Quick commands in the file browser context menu
  // ------------------------------------------------------------------

  document.addEventListener(
    "contextmenu",
    (event) => {
      const row = event.target.closest && event.target.closest(".jp-DirListing-item");
      lastContextEntry = row
        ? {
            name: (row.querySelector(".jp-DirListing-itemText span") || {}).textContent?.trim() || "",
            isDir: row.getAttribute("data-isdir") === "true",
          }
        : null;
      // The terminal's own menu is left alone. Shift+right-click already
      // opens the native browser menu with a working Copy, and the Ctrl+C
      // problem is handled by the keydown listener below.
    },
    true
  );

  /**
   * Quotes a value for a POSIX shell. A folder name is external data (it can
   * come from someone else's repository) and ends up on a shell line, so wrap
   * it in single quotes and write an inner quote as '\''. Spaces, `;` and
   * `$()` then stay part of the name instead of becoming commands.
   */
  function shQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }

  /** A menu entry styled like Lumino's own items. */
  function buildQuickCommandItem(label, command) {
    const li = document.createElement("li");
    li.className = "lm-Menu-item";
    li.setAttribute("role", "menuitem");
    li.tabIndex = 0;
    li.style.pointerEvents = "auto";
    li.style.cursor = "pointer";
    li.dataset.ostQuickCommand = "1";

    const icon = document.createElement("div");
    icon.className = "lm-Menu-itemIcon";
    const text = document.createElement("div");
    text.className = "lm-Menu-itemLabel";
    text.textContent = label;
    const shortcut = document.createElement("div");
    shortcut.className = "lm-Menu-itemShortcut";
    const submenu = document.createElement("div");
    submenu.className = "lm-Menu-itemSubmenuIcon";
    li.append(icon, text, shortcut, submenu);

    // Hover colour is set by hand: the class Lumino uses to highlight its own
    // items depends on internal state, so without this the entry would look
    // dead.
    li.addEventListener("mouseenter", () => {
      li.style.background = "rgba(255, 255, 255, 0.08)";
    });
    li.addEventListener("mouseleave", () => {
      li.style.background = "";
    });

    const run = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      runInTerminal(command, true);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    };
    li.addEventListener("pointerdown", run, true);
    li.addEventListener("mousedown", run, true);
    li.addEventListener("click", run, true);
    return li;
  }

  /**
   * Adds quick commands to the file browser menu: zip/install/update for a
   * folder, unzip for a .zip file.
   *
   * The target is read from the current `lastContextEntry` every time. Lumino
   * can keep a single menu element alive and reposition it instead of
   * rebuilding it, so a "done once" flag left stale entries with the wrong
   * folder baked into the command.
   */
  function addQuickCommands(menu) {
    const list = menu.querySelector(".lm-Menu-content");
    if (!list) {
      return;
    }
    const entry = lastContextEntry;
    const wantedName = entry ? entry.name : "";

    // Compare with the entry the menu was last built for, so it is only
    // rebuilt when the target really changed and not on every DOM mutation
    // while the menu merely stays open.
    if (list.dataset.ostQuickFor === wantedName) {
      return;
    }
    for (const old of list.querySelectorAll('[data-ost-quick-command="1"]')) {
      old.remove();
    }
    list.dataset.ostQuickFor = wantedName;
    if (!wantedName) {
      return;
    }

    if (entry.isDir) {
      list.appendChild(
        buildQuickCommandItem("Zip folder", `zip -r ${shQuote(wantedName + ".zip")} ${shQuote(wantedName)}`)
      );
      // Odoo module names are plain identifiers. Any other folder is not a
      // module and must not reach odoo-bin.
      if (MODULE_NAME_RE.test(wantedName)) {
        list.appendChild(buildQuickCommandItem("Install module", `odoo-bin -i ${wantedName} --st`));
        list.appendChild(buildQuickCommandItem("Update module", `odoo-bin -u ${wantedName} --st`));
      }
    } else if (/.zip$/i.test(wantedName)) {
      list.appendChild(buildQuickCommandItem("Unzip archive", `unzip ${shQuote(wantedName)}`));
    }
  }

  /**
   * Lumino menus are anonymous until you look inside, and the class is the
   * same for every context menu in the app, so the file browser menu is
   * recognised by the commands it contains.
   */
  function augmentEditorMenu(node) {
    if (node.querySelector('[data-command^="filebrowser:"]')) {
      addQuickCommands(node);
    }
  }

  /**
   * Scans the whole document instead of trusting which node a mutation
   * reports: Lumino sometimes mounts the menu inside an intermediate wrapper
   * created at the same moment. `.lm-Menu` is almost always absent, so the
   * query is cheap.
   */
  function scanForContextMenus() {
    const { settings } = ns.state;
    if (!settings.enabled || !settings.shellUi) {
      return;
    }
    for (const menu of document.querySelectorAll(".lm-Menu")) {
      augmentEditorMenu(menu);
    }
  }

  // ------------------------------------------------------------------
  // Ctrl+C as copy inside the terminal
  // ------------------------------------------------------------------

  /**
   * Real copy with Ctrl+C in the editor terminal, without also sending the
   * interrupt.
   *
   * xterm.js always treats Ctrl+C as SIGINT: its own handler calls
   * preventDefault before the browser can do a native copy, which is why "^C"
   * showed up even with text selected. This listener sits one level above it
   * (a content script at document_start registers long before Jupyter mounts
   * its handlers, and on the same node and phase the first one wins) and
   * decides whether to copy instead of interrupting.
   *
   * Both conditions must hold: we are in the Odoo.sh editor AND focus is
   * inside a terminal. Elsewhere Ctrl+C keeps doing what it always did.
   */
  document.addEventListener(
    "keydown",
    (event) => {
      const { settings } = ns.state;
      if (!settings.enabled || !settings.shellUi) {
        return;
      }
      // event.code is layout independent. event.key would miss the shortcut
      // on non-Latin keyboard layouts.
      if (event.code !== "KeyC") {
        return;
      }
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
      }
      if (!editorPresent()) {
        return;
      }
      const inTerminal = event.target.closest && event.target.closest(".jp-Terminal, .xterm");
      if (!inTerminal) {
        return;
      }
      const selection = window.getSelection();
      // With nothing selected Ctrl+C stays what it has always been in a
      // terminal: interrupt the running command.
      if (!selection || selection.isCollapsed || !selection.toString()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try {
        document.execCommand("copy");
      } catch (err) {
        // No reliable alternative from here. Fail quietly rather than let the
        // interrupt through anyway.
      }
    },
    true
  );

  Object.assign(ns.editor, {
    editorPresent,
    visibleTerminal,
    activeTabLabel,
    injectBridge,
    runInTerminal,
    applyEditorMenu,
    scanForContextMenus,
  });
})(globalThis.OstContent);
