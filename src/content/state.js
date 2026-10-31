/**
 * Per-tab state: global switches, the profile and media stored for this host.
 *
 * Fields are always read through `ns.state` at call time. They are replaced
 * wholesale whenever storage changes, so never cache them in a closure.
 */
(function (ns) {
  "use strict";

  const HOST = window.location.hostname;
  const PROFILE_KEY = globalThis.ostProfileKey(HOST);
  const MEDIA_KEY = globalThis.ostMediaKey(HOST);

  ns.HOST = HOST;
  ns.STORAGE_KEYS = [globalThis.OST_KEY_SETTINGS, PROFILE_KEY, MEDIA_KEY, globalThis.OST_KEY_SCRIPTS];

  ns.state = {
    // Switches that apply everywhere.
    settings: globalThis.ostNormalizeGlobal(null),
    // Appearance stored for this domain.
    profile: globalThis.ostNormalizeProfile(null),
    media: globalThis.ostNormalizeMedia(null),
    scripts: [],
    // Environment label currently shown by the badge ("" when hidden).
    env: "",
  };

  /**
   * There is deliberately no fallback to a shared "*" profile: a domain that
   * was never customised must get the factory values (everything off), not
   * the look chosen for another project.
   */
  ns.readState = function (record) {
    ns.state.settings = globalThis.ostNormalizeGlobal(record[globalThis.OST_KEY_SETTINGS]);
    ns.state.profile = globalThis.ostNormalizeProfile(record[PROFILE_KEY]);
    ns.state.media = globalThis.ostNormalizeMedia(record[MEDIA_KEY]);
    ns.state.scripts = globalThis.ostNormalizeScripts(record[globalThis.OST_KEY_SCRIPTS]);
  };
})(globalThis.OstContent);
