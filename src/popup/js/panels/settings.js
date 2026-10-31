/**
 * Settings tab: language, developer section, per-domain reset, version.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, card, row, toggle, button, note } = ns.ui;

  let confirmReset = false;

  function render() {
    const s = store.settings;
    const host = store.profileHost === globalThis.OST_DEFAULT_HOST ? t("st.noDomain") : store.profileHost;
    const manifest = chrome.runtime.getManifest();

    return h(
      "div",
      { class: "panel" },
      card(
        t("st.general"),
        row(
          t("st.language"),
          null,
          h(
            "select",
            { class: "select", "aria-label": t("st.language"), onchange: (e) => actions.setSettings({ language: e.target.value }) },
            globalThis.OST_LANGUAGES.map((l) => h("option", { value: l.code, selected: l.code === s.language }, l.label))
          )
        ),
        row(t("st.devSection"), t("st.devSectionHint"), toggle(s.developerSection, (v) => actions.setSettings({ developerSection: v })))
      ),
      card(
        t("st.domain"),
        note(t("st.domainHint", { host }), "muted"),
        confirmReset
          ? h(
              "div",
              { class: "btn-row fill" },
              button(t("st.resetConfirm"), () => { confirmReset = false; actions.resetProfile(); }, { kind: "danger" }),
              button(t("common.cancel"), () => { confirmReset = false; actions.notify(); }, { kind: "ghost" })
            )
          : button(t("st.reset"), () => { confirmReset = true; actions.notify(); }, { kind: "ghost" })
      ),
      card(
        t("st.about"),
        h("p", { class: "about" }, manifest.name, " ", h("code", null, "v" + manifest.version)),
        note(t("st.aboutHint"), "muted")
      )
    );
  }

  ns.panels = ns.panels || {};
  ns.panels.settings = render;
})(globalThis.OstPopup);
