/**
 * Small DOM toolkit shared by the panels: an element builder, translation
 * lookup and the form controls. Controls are plain DOM, no framework.
 */
(function (ns) {
  "use strict";

  /** Translates a key, falling back to English, then to the key itself. */
  function t(key, vars) {
    const lang = ns.store.settings.language;
    const table = globalThis.OST_STRINGS;
    let text = (table[lang] && table[lang][key]) || table.en[key] || key;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
    }
    return text;
  }

  /** h("div", { class: "x", onclick: fn }, child, "text") */
  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value === null || value === undefined) {
        continue;
      }
      if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "class") {
        node.className = value;
      } else if (key === "html") {
        node.innerHTML = value;
      } else if (key in node && key !== "list") {
        node[key] = value;
      } else {
        node.setAttribute(key, value === true ? "" : value);
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) {
        continue;
      }
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const svg = (path, size = 16) =>
    h("span", {
      class: "ico",
      html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`,
    });

  // ------------------------------------------------------------------
  // Layout
  // ------------------------------------------------------------------

  // Kept for main.js, which calls it before every render.
  const resetSections = () => {};

  /** Bordered section. `title` may be [text, asideNode] to put a control in the header. */
  function card(title, ...children) {
    const [text, aside] = Array.isArray(title) ? title : [title, null];
    const head = text
      ? h(
          "header",
          { class: "sec-hd" },
          h("span", null, text),
          aside ? h("span", { class: "aside" }, aside) : null
        )
      : null;
    return h("section", { class: "sec" }, head, h("div", { class: "sec-bd" }, ...children));
  }

  /** A labelled row: text on the left, control on the right. */
  function row(label, hint, control) {
    return h(
      "div",
      { class: "row" },
      h("div", { class: "row-text" }, h("div", { class: "row-label" }, label), hint ? h("div", { class: "row-hint" }, hint) : null),
      control ? h("div", { class: "row-control" }, control) : null
    );
  }

  /** Field stacked under its label, for wide controls such as sliders. */
  function field(label, control, value) {
    return h(
      "div",
      { class: "field" },
      h("div", { class: "field-head" }, h("span", { class: "field-label" }, label), value ? h("span", { class: "field-value" }, value) : null),
      control
    );
  }

  // ------------------------------------------------------------------
  // Controls
  // ------------------------------------------------------------------

  function toggle(checked, onChange, label) {
    const input = h("input", { type: "checkbox", checked: !!checked, "aria-label": label || "" });
    input.addEventListener("change", () => onChange(input.checked));
    return h("label", { class: "switch" }, input, h("span", { class: "switch-track" }));
  }

  /** Segmented control. options: [{value, label, icon?}] */
  function segmented(options, value, onChange) {
    return h(
      "div",
      { class: "seg", role: "radiogroup" },
      options.map((o) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            class: "seg-btn" + (o.value === value ? " on" : ""),
            "aria-checked": String(o.value === value),
            title: o.title || "",
            onclick: () => onChange(o.value),
          },
          o.icon || null,
          o.label
        )
      )
    );
  }

  /** Slider that reports continuously and shows its value in the field header. */
  function slider({ min, max, step = 1, value, onInput, format }) {
    const out = h("span", { class: "field-value" }, format ? format(value) : String(value));
    const input = h("input", { type: "range", min, max, step, value, class: "range" });
    const paint = () => input.style.setProperty("--fill", ((input.value - min) / (max - min)) * 100 + "%");
    paint();
    input.addEventListener("input", () => {
      paint();
      out.textContent = format ? format(Number(input.value)) : input.value;
      onInput(Number(input.value));
    });
    return { input, out };
  }

  function sliderField(label, opts) {
    const { input, out } = slider(opts);
    return h("div", { class: "field" }, h("div", { class: "field-head" }, h("span", { class: "field-label" }, label), out), input);
  }

  function colorInput(value, onInput, label) {
    const input = h("input", { type: "color", value, class: "color", "aria-label": label || "" });
    input.addEventListener("input", () => onInput(input.value));
    return input;
  }

  function textInput({ value = "", placeholder = "", onSubmit, button }) {
    const input = h("input", { type: "text", class: "text", value, placeholder, spellcheck: false });
    const submit = () => {
      const v = input.value.trim();
      if (v) {
        onSubmit(v);
        input.value = "";
      }
    };
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    return h("div", { class: "input-group" }, input, h("button", { type: "button", class: "btn", onclick: submit }, button));
  }

  function button(label, onClick, { kind = "", icon = null, title = "" } = {}) {
    return h("button", { type: "button", class: "btn " + kind, onclick: onClick, title }, icon, label);
  }

  /** Hidden file input behind a button. */
  function filePicker(label, { accept, multiple = false, onFiles, icon, kind = "" }) {
    const input = h("input", { type: "file", accept, multiple, hidden: true });
    input.addEventListener("change", () => {
      if (input.files && input.files.length) {
        onFiles(Array.from(input.files));
      }
      input.value = "";
    });
    return h("span", { class: "file-btn" }, input, button(label, () => input.click(), { icon, kind }));
  }

  /** Wrapping row of small buttons, for option lists too long for a segmented control. */
  function chips(options, value, onChange) {
    const el = segmented(options, value, onChange);
    el.className = "chips";
    return el;
  }

  function textArea(value, onInput, placeholder = "") {
    const area = h("textarea", { class: "area", spellcheck: false, placeholder });
    area.value = value;
    area.addEventListener("input", () => onInput(area.value));
    // Tab indents instead of leaving the field, as in any code editor.
    area.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        area.setRangeText("  ", area.selectionStart, area.selectionEnd, "end");
        onInput(area.value);
      }
    });
    return area;
  }

  function note(text, kind = "") {
    return h("p", { class: "note " + kind }, text);
  }

  ns.ui = { t, h, svg, card, resetSections, chips, textArea, row, field, toggle, segmented, slider, sliderField, colorInput, textInput, button, filePicker, note };
})((globalThis.OstPopup = globalThis.OstPopup || {}));
