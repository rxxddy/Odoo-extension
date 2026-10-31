/**
 * Click a field label to copy its technical name.
 *
 * In developer mode Odoo adds a `data-tooltip-info` attribute with the field
 * name to every label, but not always on the same element: in forms it sits
 * on a <sup> inside the <label>, in lists on a <div> inside the <th>. So we
 * start from the clickable anchor and look for the attribute on it or below
 * it, rather than chasing a structure that changes from view to view.
 */
(function (ns) {
  "use strict";

  const TOAST_ID = "ost-copy-toast";
  const TOAST_MS = 2000;
  const LABEL_ANCHORS = "label, th, .o_form_label, .o_horizontal_separator";

  let toastTimer = null;

  /** A click on text can arrive as a text node, so climb to its element. */
  function elementOf(target) {
    return target && target.nodeType === 3 ? target.parentElement : target;
  }

  function readFieldName(target) {
    const node = elementOf(target);
    if (!node || !node.closest) {
      return "";
    }
    const anchor = node.closest(LABEL_ANCHORS);
    if (!anchor) {
      return "";
    }
    const holder = anchor.matches("[data-tooltip-info]") ? anchor : anchor.querySelector("[data-tooltip-info]");
    if (!holder) {
      return "";
    }
    try {
      const info = JSON.parse(holder.getAttribute("data-tooltip-info"));
      return (info && info.field && info.field.name) || "";
    } catch (err) {
      return "";
    }
  }

  function showToast(text) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), TOAST_MS);
  }

  /**
   * navigator.clipboard can be denied in a content script. The temporary
   * textarea fallback works everywhere, so a copy never fails silently.
   */
  function copyText(text) {
    const fallback = () => {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        // Nothing more we can do. Just don't break the click.
      }
      field.remove();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
  }

  function onLabelClick(event) {
    const { settings } = ns.state;
    if (!settings.enabled || !settings.copyFieldNames) {
      return;
    }
    const name = readFieldName(event.target);
    if (!name) {
      return;
    }
    const node = elementOf(event.target);
    const label = node && node.closest ? node.closest("label") : null;

    if (label) {
      // Clicking a checkbox label toggles it. While copying is on, suppress
      // that, or the value changes when the user only wanted to read the
      // field name. Only <label> is affected: list headers still sort.
      event.preventDefault();

      const control = label.control || (label.htmlFor ? document.getElementById(label.htmlFor) : null);
      const isToggle = control && /^(checkbox|radio)$/i.test(control.type || "");
      if (isToggle || label.querySelector('input[type="checkbox"], input[type="radio"]')) {
        // Some widgets toggle from their own handler, which preventDefault
        // does not stop, so block propagation too.
        event.stopPropagation();
      }
    }

    copyText(name);
    showToast("Copied");
  }

  function removeToast() {
    const toast = document.getElementById(TOAST_ID);
    if (toast) {
      toast.remove();
    }
  }

  /** One document-level listener: Odoo views re-render constantly, so per-label handlers would need redoing each time. */
  function install() {
    document.addEventListener("click", onLabelClick, true);
  }

  ns.fieldNames = { install, removeToast };
})(globalThis.OstContent);
