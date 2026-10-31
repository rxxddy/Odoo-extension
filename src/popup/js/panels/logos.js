/**
 * Logos tab: any number of logos over any backdrop, placed with sliders.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, card, sliderField, button, filePicker, note, svg } = ns.ui;
  const media = ns.media;

  let message = "";

  async function addFiles(files) {
    for (const file of files) {
      const code = await media.importLogo(file);
      if (code) {
        message = t(code === "limit" ? "lg.err.limit" : "lg.err.format", { max: globalThis.OST_MAX_LOGOS });
        actions.notify();
        return;
      }
    }
    message = "";
  }

  /** Updates one logo without re-rendering, so a slider keeps focus while dragged. */
  function tweak(logo, patch) {
    Object.assign(logo, patch);
    actions.quiet("media", {});
  }

  function logoItem(logo, index) {
    return h(
      "div",
      { class: "item" },
      h(
        "div",
        { class: "item-head" },
        h("span", { class: "item-thumb" }, h("img", { src: logo.data, alt: "" })),
        h("span", { class: "item-name" }, logo.name || t("lg.untitled", { n: index + 1 })),
        h(
          "button",
          {
            type: "button",
            class: "icon-btn",
            "aria-label": t("common.remove"),
            onclick: () => actions.setMedia({ logos: store.media.logos.filter((l) => l !== logo) }),
          },
          svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>', 14)
        )
      ),
      h(
        "div",
        { class: "two" },
        sliderField(t("lg.size"), { min: 24, max: 800, step: 4, value: logo.size, format: (v) => v + "px", onInput: (v) => tweak(logo, { size: v }) }),
        sliderField(t("lg.opacity"), { min: 0.05, max: 1, step: 0.05, value: logo.opacity, format: (v) => Math.round(v * 100) + "%", onInput: (v) => tweak(logo, { opacity: v }) })
      ),
      h(
        "div",
        { class: "two" },
        sliderField("X", { min: 0, max: 100, value: logo.x, format: (v) => v + "%", onInput: (v) => tweak(logo, { x: v }) }),
        sliderField("Y", { min: 0, max: 100, value: logo.y, format: (v) => v + "%", onInput: (v) => tweak(logo, { y: v }) })
      )
    );
  }

  function render() {
    const logos = store.media.logos;
    return h(
      "div",
      { class: "panel" },
      card(
        [t("lg.title"), h("span", null, `${logos.length}/${globalThis.OST_MAX_LOGOS}`)],
        h(
          "div",
          { class: "btn-row fill" },
          filePicker(t("lg.add"), { accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml", multiple: true, onFiles: addFiles, kind: "primary" }),
          logos.length ? button(t("lg.clear"), () => actions.setMedia({ logos: [] }), { kind: "ghost" }) : null
        ),
        message ? note(message, "warn") : null,
        logos.length ? logos.map(logoItem) : note(t("lg.empty", { max: globalThis.OST_MAX_LOGOS }), "muted")
      )
    );
  }

  ns.panels = ns.panels || {};
  ns.panels.logos = render;
})(globalThis.OstPopup);
