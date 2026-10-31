/**
 * Environment badge (PROD / STAGING / DEV) and database name lookup.
 */
(function (ns) {
  "use strict";

  const BADGE_ID = "ost-env-badge";
  const MAX_NOTICE_LENGTH = 800;

  const DEV_PATTERNS = [
    /temporary odoo\.sh development environment/i,
    /development databases are not backed up/i,
  ];

  ns.BADGE_ID = BADGE_ID;

  /** A development branch is recognised by its banner: the hostname alone cannot tell. */
  function hasDevBanner() {
    for (const el of document.querySelectorAll(".alert")) {
      const text = el.textContent || "";
      if (text.length <= MAX_NOTICE_LENGTH && DEV_PATTERNS.some((re) => re.test(text))) {
        return true;
      }
    }
    return false;
  }

  function detectEnvironment() {
    const { settings, profile, env } = ns.state;
    if (!settings.enabled || !settings.badgeEnabled || profile.badgeHidden) {
      return "";
    }
    // Once DEV is detected it never changes, so skip re-scanning the alerts
    // on every DOM mutation.
    if (env === "DEV") {
      return "DEV";
    }
    if (document.body && hasDevBanner()) {
      return "DEV";
    }
    return globalThis.ostHostEnvironment(ns.HOST);
  }

  function applyBadge() {
    const detected = detectEnvironment();
    const existing = document.getElementById(BADGE_ID);

    if (!detected) {
      ns.state.env = "";
      if (existing) {
        existing.remove();
      }
      return;
    }
    const changed = detected !== ns.state.env;
    ns.state.env = detected;

    if (!document.body) {
      return;
    }
    if (!existing) {
      const badge = document.createElement("div");
      badge.id = BADGE_ID;
      badge.textContent = detected;
      badge.setAttribute("role", "status");
      document.body.appendChild(badge);
    } else if (existing.textContent !== detected) {
      existing.textContent = detected;
    }
    if (changed) {
      // The automatic colour depends on the environment, so the stylesheet
      // has to be regenerated when the verdict changes.
      ns.styles.applyCss();
    }
  }

  /** Odoo prints the database name under the user name, in a monospace <mark>. */
  function readDatabaseName() {
    const mark = document.querySelector(".oe_topbar_name mark, .o_user_menu mark");
    return mark ? mark.textContent.trim() : "";
  }

  ns.environment = { applyBadge, readDatabaseName };
})(globalThis.OstContent);
