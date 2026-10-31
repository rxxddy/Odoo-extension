/**
 * Workspace tab: environment badge, hidden banners and per-domain enabling.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, card, row, toggle, segmented, sliderField, colorInput, button, note } = ns.ui;

  let recognizeState = "";

  async function recognize() {
    recognizeState = "busy";
    actions.notify();
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "ost:recognize-host", origin: store.tab.origin, tabId: store.tab.id },
        (r) => resolve(chrome.runtime.lastError ? null : r)
      );
    });
    if (response && response.ok) {
      recognizeState = "";
      await actions.load();
      return;
    }
    recognizeState = response && response.error === "permission denied" ? "denied" : "failed";
    actions.notify();
  }

  /** Offers to enable a non-Odoo address (localhost, internal domain). Hidden on standard Odoo hosts. */
  function recognizeCard() {
    const tab = store.tab;
    if (tab.recognized || !/^https?:/.test(tab.origin) || globalThis.OST_STATIC_ODOO_RE.test(tab.host)) {
      return null;
    }
    return card(
      t("ws.recognize"),
      note(t("ws.recognizeHint", { host: tab.host }), "muted"),
      button(recognizeState === "busy" ? t("ws.requesting") : t("ws.enableHere"), recognize, { kind: "primary" }),
      recognizeState === "denied" ? note(t("ws.denied"), "warn") : null,
      recognizeState === "failed" ? note(t("ws.failed"), "warn") : null
    );
  }

  function badgeCard() {
    const s = store.settings;
    const customColor = s.badgeColor !== "auto";
    return card(
      [t("ws.badge"), toggle(s.badgeEnabled, (v) => actions.setSettings({ badgeEnabled: v }), t("ws.badge"))],
      note(t("ws.badgeHint"), "muted"),
      s.badgeEnabled
        ? [
            row(
              t("ws.corner"),
              null,
              segmented(
                [{ value: "tl", label: "↖" }, { value: "tr", label: "↗" }, { value: "bl", label: "↙" }, { value: "br", label: "↘" }],
                s.badgeCorner,
                (v) => actions.setSettings({ badgeCorner: v })
              )
            ),
            sliderField(t("ws.size"), { min: 9, max: 22, value: s.badgeSize, format: (v) => v + "px", onInput: (v) => actions.quiet("settings", { badgeSize: v }) }),
            row(
              t("ws.color"),
              null,
              h(
                "div",
                { class: "pair" },
                segmented(
                  [{ value: "auto", label: t("ws.colorAuto") }, { value: "custom", label: t("ws.colorCustom") }],
                  customColor ? "custom" : "auto",
                  (v) => actions.setSettings({ badgeColor: v === "auto" ? "auto" : "#ff3d6e" })
                ),
                customColor ? colorInput(s.badgeColor, (v) => actions.quiet("settings", { badgeColor: v })) : null
              )
            ),
            row(t("ws.badgeHide"), t("ws.badgeHideHint"), toggle(store.profile.badgeHidden, (v) => actions.setProfile({ badgeHidden: v }))),
          ]
        : null
    );
  }

  function bannersCard() {
    const p = store.profile;
    return card(
      t("ws.banners"),
      row(t("ws.hideTrial"), t("ws.hideTrialHint"), toggle(p.hideTrialBanner, (v) => actions.setProfile({ hideTrialBanner: v }))),
      row(t("ws.hideNeutral"), t("ws.hideNeutralHint"), toggle(p.hideNeutralizeBanner, (v) => actions.setProfile({ hideNeutralizeBanner: v })))
    );
  }

  function render() {
    return h("div", { class: "panel" }, recognizeCard(), badgeCard(), bannersCard());
  }

  ns.panels = ns.panels || {};
  ns.panels.workspace = render;
})(globalThis.OstPopup);
