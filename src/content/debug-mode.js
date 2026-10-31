/**
 * Developer mode: reloads the web client once with ?debug=1.
 */
(function (ns) {
  "use strict";

  // Session flag that prevents a redirect loop when the server ignores the
  // debug parameter (non-internal user, session without rights, and so on).
  const ATTEMPT_FLAG = "ost:debug-attempted";

  // Set when a request arrives while the tab is in the background.
  let pending = false;

  /**
   * @param {boolean} [force] Skip the session flag. Used when the user has
   *   just flipped the switch and expects it to act immediately.
   */
  function maybeEnableDebug(force) {
    const { settings } = ns.state;
    if (!settings.enabled || !settings.debugMode || !document.body) {
      return;
    }
    // Only act inside the web client. On login, portal and website pages the
    // parameter is meaningless.
    if (!document.body.classList.contains("o_web_client")) {
      return;
    }
    // data-odoo-debug-mode is the only reliable source: window.odoo lives in
    // the main world and is not readable from a content script.
    if (document.body.dataset.odooDebugMode) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has("debug")) {
      return;
    }
    // Never reload a background tab under the user's feet. Wait until it is
    // brought back to the foreground.
    if (document.hidden) {
      pending = true;
      return;
    }
    try {
      if (!force && window.sessionStorage.getItem(ATTEMPT_FLAG)) {
        return;
      }
      window.sessionStorage.setItem(ATTEMPT_FLAG, "1");
    } catch (err) {
      // Without sessionStorage we cannot guard against a reload loop, so
      // give up on the redirect.
      return;
    }

    url.searchParams.set("debug", "1");
    window.location.replace(url.toString());
  }

  /** Resumes a request that was postponed because the tab was hidden. */
  function resumePending() {
    if (pending && !document.hidden) {
      pending = false;
      maybeEnableDebug(true);
    }
  }

  ns.debugMode = { maybeEnableDebug, resumePending };
})(globalThis.OstContent);
