/**
 * Icons tab: frame style, accent colours, motion, shape and labels.
 * Style samples are rendered with the same generated CSS the page gets.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, card, row, toggle, segmented, chips, sliderField, colorInput, note } = ns.ui;

  const HOME = "body.o_home_menu_background .o_apps";

  // A neutral stand-in app icon: flat colour with a simple chart glyph.
  const SAMPLE =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1aa89c"/><rect x="16" y="34" width="8" height="14" rx="2" fill="#fff"/><rect x="28" y="24" width="8" height="24" rx="2" fill="#fff"/><rect x="40" y="16" width="8" height="32" rx="2" fill="#fff" opacity=".85"/></svg>'
    );

  const sampleStyle = h("style");
  document.head.append(sampleStyle);

  /** Scoped copy of the page CSS for each style sample, including the current motion. */
  function sampleCss() {
    const p = store.profile;
    return globalThis.OST_ICON_STYLES.map((style) => {
      const css = globalThis.ostIconCss(Object.assign({}, p, { iconStyle: style, iconIntro: false }));
      return css.split(HOME).join(".pv-" + style);
    }).join("\n");
  }

  function stylePick(style) {
    const p = store.profile;
    return h(
      "button",
      {
        type: "button",
        class: "pick pv pv-" + style + (p.iconStyle === style ? " on" : ""),
        onclick: () => actions.setProfile({ iconStyle: style, iconsEnabled: true }),
      },
      h("span", { class: "pick-art o_app" }, h("img", { class: "o_app_icon", src: SAMPLE, alt: "" })),
      t("is." + style)
    );
  }

  function accentSwatches() {
    const p = store.profile;
    return h(
      "div",
      { class: "swatches" },
      globalThis.OST_ACCENTS.map((c) => {
        const b = h("button", {
          type: "button",
          class: "swatch" + (p.iconAccent === c[0] && p.iconAccent2 === c[1] ? " on" : ""),
          "aria-label": c.join(" "),
          onclick: () => actions.setProfile({ iconAccent: c[0], iconAccent2: c[1] }),
        });
        b.style.background = `linear-gradient(135deg, ${c[0]}, ${c[1]})`;
        return b;
      })
    );
  }

  function render() {
    const p = store.profile;
    sampleStyle.textContent = sampleCss();

    return h(
      "div",
      { class: "panel" },
      card(
        [t("ic.style"), toggle(p.iconsEnabled, (v) => actions.setProfile({ iconsEnabled: v }), t("ic.style"))],
        h("div", { class: "grid-4" }, globalThis.OST_ICON_STYLES.map(stylePick)),
        note(t("ic.hint"), "muted")
      ),
      card(
        t("ic.accent"),
        accentSwatches(),
        row(
          t("ic.custom"),
          null,
          h(
            "div",
            { class: "pair" },
            colorInput(p.iconAccent, (v) => actions.quiet("profile", { iconAccent: v }), "A"),
            colorInput(p.iconAccent2, (v) => actions.quiet("profile", { iconAccent2: v }), "B")
          )
        )
      ),
      card(
        t("ic.motion"),
        chips(
          globalThis.OST_ICON_MOTIONS.map((m) => ({ value: m, label: t("im." + m) })),
          p.iconMotion,
          (v) => actions.setProfile({ iconMotion: v, iconsEnabled: true })
        ),
        row(t("ic.intro"), t("ic.introHint"), toggle(p.iconIntro, (v) => actions.setProfile({ iconIntro: v, iconsEnabled: true })))
      ),
      card(
        t("ic.shape"),
        segmented(
          globalThis.OST_ICON_SHAPES.map((s) => ({ value: s, label: t("sh." + s) })),
          p.iconShape,
          (v) => actions.setProfile({ iconShape: v, iconsEnabled: true })
        ),
        sliderField(t("ic.scale"), { min: 60, max: 100, value: p.iconScale, format: (v) => v + "%", onInput: (v) => actions.quiet("profile", { iconScale: v }) })
      ),
      card(
        t("ic.labels"),
        row(
          t("ic.labelColor"),
          null,
          segmented(
            globalThis.OST_LABEL_MODES.map((m) => ({ value: m, label: t("lb." + m) })),
            p.labelColor,
            (v) => actions.setProfile({ labelColor: v })
          )
        ),
        row(
          t("ic.labelFont"),
          null,
          h(
            "select",
            { class: "select", "aria-label": t("ic.labelFont"), onchange: (e) => actions.setProfile({ labelFont: e.target.value }) },
            globalThis.OST_LABEL_FONTS.map((f) => h("option", { value: f, selected: f === p.labelFont }, t("lf." + f)))
          )
        ),
        // 9 on the slider stands for "Odoo's own size" (stored as 0).
        sliderField(t("ic.labelSize"), {
          min: 9, max: 20, value: p.labelSize || 9,
          format: (v) => (v === 9 ? t("lf.default") : v + "px"),
          onInput: (v) => actions.quiet("profile", { labelSize: v === 9 ? 0 : v }),
        }),
        row(t("ic.hideNames"), null, toggle(p.hideAppNames, (v) => actions.setProfile({ hideAppNames: v })))
      )
    );
  }

  ns.panels = ns.panels || {};
  ns.panels.icons = render;
})(globalThis.OstPopup);
