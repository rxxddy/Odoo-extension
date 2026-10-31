/**
 * Builds and injects the single <style> element owned by the extension.
 */
(function (ns) {
  "use strict";

  const STYLE_ID = "ost-injected-style";

  ns.STYLE_ID = STYLE_ID;

  function shellMenuCss() {
    const cls = "." + ns.editor.MENU_ITEM_CLASS;
    return `
      ${cls} .lm-MenuBar-itemLabel {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #22e4ff;
      }
      ${cls}:hover { background: rgba(255, 255, 255, 0.08); }
    `;
  }

  function buildCss() {
    const { settings, profile, env } = ns.state;
    if (!settings.enabled) {
      return "";
    }
    const chunks = ns.wallpaper.wallpaperCss();

    if (env) {
      chunks.push(globalThis.ostBadgeCss(settings, env));
    }

    // The whole icon block hangs off one switch. When it is off (the factory
    // value) not a single icon rule is generated, which is the strongest
    // guarantee that Odoo's icons stay untouched until the user opts in.
    if (profile.iconsEnabled) {
      chunks.push(globalThis.ostIconCss(profile));
      chunks.push(globalThis.ostLabelCss(profile.labelColor));
      if (profile.hideAppNames) {
        chunks.push(globalThis.ostNoLabelsCss());
      }
    }

    if (settings.copyFieldNames) {
      chunks.push(globalThis.ostToastCss());
    }
    if (settings.shellUi) {
      chunks.push(shellMenuCss());
    }
    if (settings.scriptDock) {
      chunks.push(globalThis.ostDockCss());
    }

    // Honour the OS preference: no icon animation.
    chunks.push(`
      @media (prefers-reduced-motion: reduce) {
        body.o_home_menu_background .o_apps .o_app_icon,
        body.o_home_menu_background .o_apps .o_app.o_menuitem {
          transition: none !important;
        }
      }
    `);

    return chunks.filter(Boolean).join("\n");
  }

  function applyCss() {
    const css = buildCss();
    let node = document.getElementById(STYLE_ID);

    if (!css) {
      if (node) {
        node.remove();
      }
      return;
    }
    if (!node) {
      node = document.createElement("style");
      node.id = STYLE_ID;
      // <head> can be null at document_start, documentElement never is.
      (document.head || document.documentElement).appendChild(node);
    }
    node.textContent = css;
  }

  ns.styles = { applyCss };
})(globalThis.OstContent);
