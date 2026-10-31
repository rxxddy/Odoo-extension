/**
 * Content-script entry point: wires the modules together and reacts to
 * storage changes.
 *
 * Runs at document_start, so <body> does not exist yet and any DOM work on
 * the app must be deferred. The features (styles, banners, debug mode, media
 * layers) are independent: one failing must not take the others down.
 */
(function (ns) {
  "use strict";

  // The script can be injected twice: once registered for a custom host and
  // once on demand from the popup.
  if (ns.booted) {
    return;
  }
  ns.booted = true;

  const MUTATION_DEBOUNCE_MS = 50;

  let domObserver = null;
  let bodyClassObserver = null;
  let mutationTimer = null;

  // ------------------------------------------------------------------
  // Observers
  // ------------------------------------------------------------------

  /** Work to redo after the DOM changes. Odoo re-renders on every view switch. */
  function onDomMutated() {
    ns.banners.hideTrialBanners();
    ns.banners.hideNeutralizeBanner();
    ns.environment.applyBadge();
    ns.scriptDock.apply();
    ns.editor.applyEditorMenu();
    ns.editor.scanForContextMenus();
    if (ns.wallpaper.wallpaperMode() === "video") {
      ns.mediaLayers.ensureVideoLayer();
    }
  }

  /**
   * Mutation bursts are coalesced: Odoo can fire hundreds per frame and the
   * handlers above query the DOM, so run them at most once per interval.
   */
  function scheduleMutationWork() {
    if (mutationTimer !== null) {
      return;
    }
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      onDomMutated();
    }, MUTATION_DEBOUNCE_MS);
  }

  function startObservers() {
    if (!document.body) {
      return;
    }
    if (!domObserver) {
      domObserver = new MutationObserver(scheduleMutationWork);
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Separate observer without subtree: body classes only change when
    // entering or leaving the home menu, while the inner DOM mutates all the
    // time. Keeping them apart avoids running the video logic on every
    // mutation.
    if (!bodyClassObserver) {
      bodyClassObserver = new MutationObserver(ns.mediaLayers.syncVideoPlayback);
      bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function stopObservers() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    if (bodyClassObserver) {
      bodyClassObserver.disconnect();
      bodyClassObserver = null;
    }
    clearTimeout(mutationTimer);
    mutationTimer = null;
  }

  // ------------------------------------------------------------------
  // Icon artwork
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Apply / teardown
  // ------------------------------------------------------------------

  function applyAll() {
    const { settings, profile } = ns.state;

    ns.environment.applyBadge();
    ns.styles.applyCss();
    ns.mediaLayers.applyMediaLayer();
    ns.mediaLayers.applyLogoLayer();
    ns.scriptDock.apply();
    if (settings.enabled && settings.shellUi && ns.editor.editorPresent()) {
      ns.editor.injectBridge();
    }
    ns.editor.applyEditorMenu();
    if (settings.enabled && (profile.hideTrialBanner || profile.hideNeutralizeBanner)) {
      ns.banners.hideTrialBanners();
      ns.banners.hideNeutralizeBanner();
    }
    // Whatever the user just turned off becomes visible again immediately,
    // without a page reload.
    if (!settings.enabled || !profile.hideTrialBanner || !profile.hideNeutralizeBanner) {
      ns.banners.restoreHiddenBanners();
    }
    startObservers();
  }

  /**
   * Removes every trace of the extension from the page. Used by the master
   * switch. We remove what we own (stylesheet, layers, badge), but whatever
   * Odoo computed from our styles does not revert by itself, hence the
   * reload that follows.
   *
   * @returns {boolean} Whether anything was actually removed.
   */
  function teardownEverything() {
    let removed = false;

    const style = document.getElementById(ns.STYLE_ID);
    if (style) {
      style.remove();
      removed = true;
    }
    if (document.getElementById(ns.LAYER_ID)) {
      ns.mediaLayers.removeVideoLayer();
      removed = true;
    }
    if (document.getElementById(ns.LOGO_LAYER_ID)) {
      ns.mediaLayers.removeLogoLayer();
      removed = true;
    }
    const badge = document.getElementById(ns.BADGE_ID);
    if (badge) {
      badge.remove();
      removed = true;
    }
    ns.fieldNames.removeToast();
    if (ns.scriptDock.remove()) {
      removed = true;
    }

    if (document.body) {
      document.body.classList.remove(ns.VIDEO_ON_CLASS);
    }
    ns.state.env = "";
    ns.banners.restoreHiddenBanners();
    stopObservers();

    return removed;
  }

  function onDomReady() {
    applyAll();
    ns.debugMode.maybeEnableDebug();
    ns.fieldNames.install();
    document.addEventListener("visibilitychange", () => {
      ns.mediaLayers.syncVideoPlayback();
      ns.debugMode.resumePending();
    });
  }

  // ------------------------------------------------------------------
  // Storage
  // ------------------------------------------------------------------

  chrome.storage.local.get(ns.STORAGE_KEYS, (record) => {
    ns.readState(record || {});
    ns.styles.applyCss();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
    } else {
      onDomReady();
    }
  });

  // Live updates: the popup should never have to reload the page.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    // Only keys for this domain. Other projects' settings must not trigger a
    // redraw here.
    if (!ns.STORAGE_KEYS.some((key) => key in changes)) {
      return;
    }
    const debugWasOn = ns.state.settings.debugMode;
    const wasEnabled = ns.state.settings.enabled;
    const previousVideo = ns.wallpaper.activeVideo();

    chrome.storage.local.get(ns.STORAGE_KEYS, (record) => {
      ns.readState(record || {});

      // Master switch turned off: tear everything down and reload so the
      // page returns to exactly how it was, with none of our styles left.
      if (wasEnabled && !ns.state.settings.enabled) {
        if (teardownEverything()) {
          window.location.reload();
        }
        return;
      }

      if (previousVideo !== ns.wallpaper.activeVideo()) {
        // The source changed, so the layer is rebuilt from scratch.
        ns.mediaLayers.removeVideoLayer();
      }
      applyAll();
      // A switch that was just turned on must act now, not on the next page
      // load, so bypass the session flag.
      if (!debugWasOn && ns.state.settings.debugMode) {
        ns.debugMode.maybeEnableDebug(true);
      }
    });
  });
})(globalThis.OstContent);
