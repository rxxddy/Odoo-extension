/**
 * Hides the Odoo.sh trial/staging notice and the neutralized-database banner.
 */
(function (ns) {
  "use strict";

  const TRIAL_PATTERNS = [
    /odoo\.sh trial project/i,
    /temporary odoo\.sh (staging|development) environment/i,
    /will be automatically deleted on/i,
    /typically lasts between \d+\s*(and|e)\s*\d+ hours/i,
    /(trial|staging|development) databases are not backed up/i,
    /questo database.*(prova|staging)/i,
  ];

  // Expiry panels that can be matched by selector alone.
  const EXPIRY_SELECTORS = [".o_expired_panel", ".database_expiration_panel", ".oe_instance_register"];

  const MAX_NOTICE_LENGTH = 800;

  function looksLikeTrialNotice(el) {
    const text = el.textContent || "";
    // A very long container is almost certainly an ancestor, and hiding it
    // would wipe half the page.
    if (text.length > MAX_NOTICE_LENGTH) {
      return false;
    }
    return TRIAL_PATTERNS.some((re) => re.test(text));
  }

  /**
   * Walks up from the alert to the element that should actually be hidden.
   * Odoo sometimes wraps the message in a full-screen absolute overlay that
   * swallows clicks, so hiding only the alert would leave the page covered by
   * an invisible layer.
   */
  function resolveHideTarget(alertEl) {
    let target = alertEl;
    let parent = alertEl.parentElement;
    let hops = 0;

    while (parent && hops < 4) {
      if (parent === document.body || parent === document.documentElement) {
        break;
      }
      const style = parent.getAttribute("style") || "";
      const isOverlay = /position\s*:\s*(absolute|fixed)/i.test(style) && /z-index/i.test(style);
      if (isOverlay) {
        target = parent;
        break;
      }
      if (parent.children.length === 1) {
        target = parent;
        parent = parent.parentElement;
        hops += 1;
        continue;
      }
      break;
    }
    return target;
  }

  function hide(el) {
    const target = resolveHideTarget(el);
    target.dataset.ostHidden = "1";
    target.style.setProperty("display", "none", "important");
  }

  /**
   * Red banner shown on neutralized databases. It has its own id, so no text
   * matching is needed. It keeps a separate switch from the trial notice: it
   * tells you the database sends no real e-mail, and many people prefer to
   * keep that in sight.
   */
  function hideNeutralizeBanner() {
    const { settings, profile } = ns.state;
    if (!settings.enabled || !profile.hideNeutralizeBanner || !document.body) {
      return;
    }
    const el = document.getElementById("oe_neutralize_banner");
    if (el && el.dataset.ostHidden !== "1") {
      hide(el);
    }
  }

  function hideTrialBanners() {
    const { settings, profile } = ns.state;
    if (!settings.enabled || !profile.hideTrialBanner || !document.body) {
      return;
    }
    const candidates = document.querySelectorAll(
      ".alert, .alert-info, .alert-warning, " + EXPIRY_SELECTORS.join(", ")
    );

    for (const el of candidates) {
      if (el.dataset.ostHidden === "1") {
        continue;
      }
      const isExpiryPanel = EXPIRY_SELECTORS.some((sel) => el.matches(sel));
      if (isExpiryPanel || looksLikeTrialNotice(el)) {
        hide(el);
      }
    }
  }

  /**
   * Puts back whatever should no longer be hidden. Each element records why
   * it was hidden, so turning one switch off does not bring back the banners
   * governed by the other.
   */
  function restoreHiddenBanners() {
    if (!document.body) {
      return;
    }
    const { settings, profile } = ns.state;
    const keepTrial = settings.enabled && profile.hideTrialBanner;
    const keepNeutralize = settings.enabled && profile.hideNeutralizeBanner;

    for (const el of document.querySelectorAll('[data-ost-hidden="1"]')) {
      const isNeutralize = el.id === "oe_neutralize_banner" || el.querySelector("#oe_neutralize_banner");
      if (isNeutralize ? keepNeutralize : keepTrial) {
        continue;
      }
      el.style.removeProperty("display");
      delete el.dataset.ostHidden;
    }
  }

  ns.banners = { hideTrialBanners, hideNeutralizeBanner, restoreHiddenBanners };
})(globalThis.OstContent);
