/**
 * Popup state and persistence.
 *
 * Settings are global, the profile and media belong to the domain of the
 * active tab, and the library is shared by every domain. Writes are debounced
 * so dragging a slider does not hammer chrome.storage.
 */
(function (ns) {
  "use strict";

  const SAVE_DELAY = 150;
  const listeners = new Set();

  const store = {
    settings: globalThis.ostNormalizeGlobal(null),
    profile: globalThis.ostNormalizeProfile(null),
    media: globalThis.ostNormalizeMedia(null),
    library: [],
    scripts: [],
    customHosts: [],
    // Domain of the active tab and what the content script reported about it.
    tab: { id: null, origin: "", host: "", database: "", environment: "", recognized: false },
    // Domain whose profile is being edited ("*" outside Odoo).
    profileHost: globalThis.OST_DEFAULT_HOST,
  };

  const timers = {};

  function debounced(name, fn) {
    clearTimeout(timers[name]);
    timers[name] = setTimeout(fn, SAVE_DELAY);
  }

  const profileKey = () => globalThis.ostProfileKey(store.profileHost);
  const mediaKey = () => globalThis.ostMediaKey(store.profileHost);

  function notify() {
    for (const fn of listeners) {
      fn();
    }
  }

  function saveSettings() {
    debounced("settings", () => chrome.storage.local.set({ [globalThis.OST_KEY_SETTINGS]: store.settings }));
  }

  function saveProfile() {
    debounced("profile", () => chrome.storage.local.set({ [profileKey()]: store.profile }));
  }

  function saveMedia() {
    chrome.storage.local.set({ [mediaKey()]: store.media });
  }

  function saveLibrary() {
    chrome.storage.local.set({ [globalThis.OST_KEY_LIBRARY]: store.library });
  }

  function setScripts(list) {
    store.scripts = list;
    chrome.storage.local.set({ [globalThis.OST_KEY_SCRIPTS]: list });
    notify();
  }

  /** Patch helpers: merge, persist, notify subscribers. */
  function setSettings(patch) {
    Object.assign(store.settings, patch);
    saveSettings();
    notify();
  }

  function setProfile(patch) {
    Object.assign(store.profile, patch);
    saveProfile();
    notify();
  }

  function setMedia(patch) {
    Object.assign(store.media, patch);
    saveMedia();
    notify();
  }

  /** Same as the setters but without notifying, for continuous input (sliders). */
  function quiet(kind, patch) {
    Object.assign(store[kind], patch);
    if (kind === "settings") saveSettings();
    else if (kind === "profile") saveProfile();
    else debounced("media", saveMedia);
  }

  function resetProfile() {
    store.profile = globalThis.ostNormalizeProfile(null);
    store.media = globalThis.ostNormalizeMedia(null);
    saveProfile();
    saveMedia();
    notify();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /** Asks the content script of the active tab about the database and environment. */
  function askActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.url) {
          resolve(null);
          return;
        }
        let url;
        try {
          url = new URL(tab.url);
        } catch (err) {
          resolve(null);
          return;
        }
        const base = { id: tab.id, origin: url.origin, host: url.hostname, database: "", environment: "", recognized: false };
        chrome.tabs.sendMessage(tab.id, { type: "ost:database" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            // No answer means no content script on the page.
            resolve(base);
            return;
          }
          resolve(Object.assign(base, {
            database: response.database || "",
            environment: response.environment || "",
            recognized: true,
          }));
        });
      });
    });
  }

  /** Loads everything for the active tab. Safe to call again (e.g. after enabling a domain). */
  async function load() {
    store.tab = (await askActiveTab()) || store.tab;
    const keys = [globalThis.OST_KEY_SETTINGS, globalThis.OST_KEY_LIBRARY, globalThis.OST_KEY_CUSTOM_HOSTS, globalThis.OST_KEY_SCRIPTS];
    const first = await chrome.storage.local.get(keys);
    store.customHosts = globalThis.ostNormalizeCustomHosts(first[globalThis.OST_KEY_CUSTOM_HOSTS]);
    store.profileHost = globalThis.ostIsOdooHost(store.tab.host, store.customHosts)
      ? store.tab.host
      : globalThis.OST_DEFAULT_HOST;

    const second = await chrome.storage.local.get([profileKey(), mediaKey()]);
    store.settings = globalThis.ostNormalizeGlobal(first[globalThis.OST_KEY_SETTINGS]);
    store.library = globalThis.ostNormalizeLibrary(first[globalThis.OST_KEY_LIBRARY]);
    store.scripts = globalThis.ostNormalizeScripts(first[globalThis.OST_KEY_SCRIPTS]);
    // No fallback to a shared profile: a domain without its own entry gets the factory values.
    store.profile = globalThis.ostNormalizeProfile(second[profileKey()]);
    store.media = globalThis.ostNormalizeMedia(second[mediaKey()]);
    notify();
  }

  ns.store = store;
  ns.actions = { setScripts, setSettings, setProfile, setMedia, quiet, resetProfile, subscribe, load, saveLibrary, notify };
})((globalThis.OstPopup = globalThis.OstPopup || {}));
