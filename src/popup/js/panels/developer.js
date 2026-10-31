/**
 * Developer tab: script buttons, debug mode, field-name copying and the
 * Odoo.sh editor tools.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, card, row, toggle, button, note, svg, textArea } = ns.ui;
  const media = ns.media;

  // Buttons get a colour in turn, so neighbours are easy to tell apart.
  const COLORS = ["#714b67", "#017e84", "#e9a23b", "#d23f3a", "#3f6fd1", "#28a745", "#8a6d3b", "#6b7280"];
  const FLASH_MS = 900;

  const editor = { found: false, label: "", checked: false, status: "" };
  // The script being edited: null when the form is closed.
  let draft = null;
  let runStatus = { text: "", kind: "" };

  function send(message) {
    return new Promise((resolve) => {
      if (store.tab.id === null) {
        resolve(null);
        return;
      }
      chrome.tabs.sendMessage(store.tab.id, message, (r) => resolve(chrome.runtime.lastError ? null : r));
    });
  }

  // ------------------------------------------------------------------
  // Scripts
  // ------------------------------------------------------------------

  function runScript(script, el) {
    chrome.runtime.sendMessage({ type: "ost:run-script", id: script.id, tabId: store.tab.id }, (result) => {
      const ok = !chrome.runtime.lastError && result && result.ok;
      runStatus = ok
        ? { text: t("sc.ran", { name: script.name }), kind: "ok" }
        : { text: t("sc.failed", { error: (result && result.error) || "no answer" }), kind: "err" };
      // Flash the button in place, then refresh the status line.
      el.classList.add(ok ? "ok" : "err");
      setTimeout(() => actions.notify(), FLASH_MS);
    });
  }

  function openEditor(script) {
    draft = script ? Object.assign({}, script) : { id: "", name: "", color: COLORS[store.scripts.length % COLORS.length], code: "" };
    actions.notify();
  }

  function saveDraft() {
    const name = draft.name.trim();
    if (!name || !draft.code.trim()) {
      runStatus = { text: t("sc.incomplete"), kind: "warn" };
      actions.notify();
      return;
    }
    const entry = { id: draft.id || media.newId(), name: name.slice(0, 40), color: draft.color, code: draft.code };
    const list = store.scripts.slice();
    const index = list.findIndex((s) => s.id === entry.id);
    if (index >= 0) list[index] = entry;
    else list.push(entry);
    draft = null;
    runStatus = { text: "", kind: "" };
    actions.setScripts(list);
  }

  function deleteDraft() {
    const id = draft.id;
    draft = null;
    actions.setScripts(store.scripts.filter((s) => s.id !== id));
  }

  function scriptButton(script) {
    const el = h(
      "div",
      { class: "script" },
      h(
        "button",
        { type: "button", class: "script-run", title: t("sc.run"), onclick: () => runScript(script, el) },
        h("span", { class: "dot" }),
        h("span", { class: "label" }, script.name)
      ),
      h(
        "button",
        { type: "button", class: "script-edit", title: t("sc.edit"), "aria-label": t("sc.edit"), onclick: () => openEditor(script) },
        svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 12)
      )
    );
    el.style.setProperty("--c", script.color);
    return el;
  }

  function editorForm() {
    const name = h("input", { type: "text", class: "text", value: draft.name, placeholder: t("sc.name"), maxLength: 40, spellcheck: false });
    name.addEventListener("input", () => (draft.name = name.value));
    return h(
      "div",
      { class: "editor" },
      name,
      textArea(draft.code, (v) => (draft.code = v), t("sc.codeHint")),
      h(
        "div",
        { class: "btn-row fill" },
        button(t("common.save"), saveDraft, { kind: "primary" }),
        button(t("common.cancel"), () => { draft = null; actions.notify(); }, { kind: "ghost" }),
        draft.id ? button(t("common.remove"), deleteDraft, { kind: "danger" }) : null
      )
    );
  }

  function scriptsCard() {
    const full = store.scripts.length >= globalThis.OST_MAX_SCRIPTS;
    return card(
      [t("sc.title"), h("span", null, `${store.scripts.length}/${globalThis.OST_MAX_SCRIPTS}`)],
      store.scripts.length || !draft
        ? h(
            "div",
            { class: "scripts" },
            store.scripts.map(scriptButton),
            draft || full ? null : h("button", { type: "button", class: "add-tile", onclick: () => openEditor(null) }, "+ ", t("sc.new"))
          )
        : null,
      draft ? editorForm() : null,
      runStatus.text ? note(runStatus.text, runStatus.kind) : note(t("sc.hint"), "muted")
    );
  }

  // ------------------------------------------------------------------
  // Odoo and editor tools
  // ------------------------------------------------------------------

  async function checkEditor() {
    const status = await send({ type: "ost:editor-status" });
    Object.assign(editor, { found: !!(status && status.found), label: (status && status.tabLabel) || "", checked: true });
    actions.notify();
  }

  async function runCommand(command) {
    editor.status = t("dev.sending");
    actions.notify();
    const result = await send({ type: "ost:editor-run", command, newTerminal: true });
    editor.status = result && result.ok ? t("dev.sent") : t("dev.failed", { error: (result && result.error) || "no answer" });
    actions.notify();
  }

  function editorCard() {
    const s = store.settings;
    return card(
      [t("dev.editor"), toggle(s.shellUi, (v) => actions.setSettings({ shellUi: v }), t("dev.editor"))],
      note(t("dev.editorToolsHint"), "muted"),
      editor.found
        ? [
            note(t("dev.editorFound", { tab: editor.label || "—" })),
            h(
              "div",
              { class: "btn-row fill" },
              button("odoo-bin shell", () => runCommand("odoo-bin shell")),
              button("psql", () => runCommand("psql"))
            ),
            editor.status ? note(editor.status, "muted") : null,
          ]
        : null,
      h(
        "ul",
        { class: "cmds" },
        ["zip -r folder.zip folder", "odoo-bin -i module --st", "odoo-bin -u module --st", "unzip archive.zip"].map((c) => h("li", null, h("code", null, c)))
      )
    );
  }

  function render() {
    const s = store.settings;
    if (!editor.checked) {
      checkEditor();
    }
    return h(
      "div",
      { class: "panel" },
      scriptsCard(),
      card(
        t("dev.odoo"),
        row(t("dev.debug"), t("dev.debugHint"), toggle(s.debugMode, (v) => actions.setSettings({ debugMode: v }))),
        row(t("dev.copy"), t("dev.copyHint"), toggle(s.copyFieldNames, (v) => actions.setSettings({ copyFieldNames: v })))
      ),
      editorCard()
    );
  }

  ns.panels = ns.panels || {};
  ns.panels.developer = render;
})(globalThis.OstPopup);
