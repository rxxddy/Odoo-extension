/**
 * Service worker.
 *
 * The manifest injects the content scripts only on *.odoo.com / *.odoo.sh, so
 * a local build (localhost, an internal domain, an IP) never gets them. For
 * those hosts the user can "recognise" the domain from the popup: we ask for
 * permission on that single origin (never on all pages at once) and register
 * the content script persistently, so it comes back on every later visit
 * without repeating the gesture.
 */

const CUSTOM_HOSTS_KEY = "ost_custom_hosts";
const SETTINGS_KEY = "ost_settings";
const SCRIPTS_KEY = "ost_scripts";
const STATIC_ODOO_RE = /(^|\.)odoo\.(com|sh)$/i;

const ICON_SETS = {
  active: {
    16: "assets/icons/icon16_active.png",
    32: "assets/icons/icon32_active.png",
    48: "assets/icons/icon48_active.png",
    128: "assets/icons/icon128_active.png",
  },
  inactive: {
    16: "assets/icons/icon16.png",
    32: "assets/icons/icon32.png",
    48: "assets/icons/icon48.png",
    128: "assets/icons/icon128.png",
  },
};

/**
 * The script list lives in the manifest only, so the static and the dynamic
 * registrations can never drift apart.
 */
function contentBundle() {
  return chrome.runtime.getManifest().content_scripts[0].js;
}

function scriptIdFor(origin) {
  // chrome.scripting ids cannot contain ':' or '/'.
  return "ost-custom-" + origin.replace(/[^a-z0-9]+/gi, "-");
}

async function rememberHost(hostname) {
  const store = await chrome.storage.local.get(CUSTOM_HOSTS_KEY);
  const hosts = Array.isArray(store[CUSTOM_HOSTS_KEY]) ? store[CUSTOM_HOSTS_KEY] : [];
  if (!hosts.includes(hostname)) {
    hosts.push(hostname);
    await chrome.storage.local.set({ [CUSTOM_HOSTS_KEY]: hosts });
  }
}

/**
 * Requests permission for the origin, registers the content script so it
 * restarts by itself on later loads, and injects it into the current tab so
 * the effect shows up without a reload.
 */
async function recognizeHost(origin, tabId) {
  let url;
  try {
    url = new URL(origin);
  } catch (err) {
    return { ok: false, error: "invalid address" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "unsupported protocol" };
  }

  const pattern = `${url.protocol}//${url.host}/*`;
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) {
    return { ok: false, error: "permission denied" };
  }

  const bundle = contentBundle();
  const id = scriptIdFor(`${url.protocol}//${url.host}`);
  try {
    // An earlier install may already have registered this domain, and a
    // second registration would fail on the duplicate id, so update instead.
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (existing.length) {
      await chrome.scripting.updateContentScripts([
        { id, matches: [pattern], js: bundle, runAt: "document_start" },
      ]);
    } else {
      await chrome.scripting.registerContentScripts([
        { id, matches: [pattern], js: bundle, runAt: "document_start", persistAcrossSessions: true },
      ]);
    }
  } catch (err) {
    return { ok: false, error: "could not register the script" };
  }

  await rememberHost(url.hostname);

  if (tabId !== undefined && tabId !== null) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: bundle });
    } catch (err) {
      // Not fatal: the persistent registration covers the next page load.
    }
  }

  return { ok: true, hostname: url.hostname };
}

// ------------------------------------------------------------------
// User scripts
// ------------------------------------------------------------------

/**
 * Runs in the page's main world, so the code sees the same globals as the
 * DevTools console (odoo, owl, the page's own variables). Output and errors
 * go to the page console under the button's name.
 */
function runInPage(name, code) {
  const label = "%c[UI Enhancer] " + name;
  const style = "color:#22e4ff;font-weight:bold";
  try {
    const result = (0, eval)(code);
    console.log(label, style, result);
    if (result && typeof result.then === "function") {
      result.then(
        (value) => console.log(label + " (resolved)", style, value),
        (error) => console.error(label + " (rejected)", style, error)
      );
    }
    return { ok: true };
  } catch (error) {
    console.error(label, style, error);
    return { ok: false, error: String((error && error.message) || error) };
  }
}

/** Fallback for pages whose CSP forbids eval: the userScripts API is exempt. */
async function runWithUserScripts(tabId, script) {
  if (!chrome.userScripts || !chrome.userScripts.execute) {
    return null;
  }
  try {
    await chrome.userScripts.execute({
      target: { tabId },
      world: "MAIN",
      js: [{ code: script.code }],
    });
    return { ok: true };
  } catch (err) {
    return null;
  }
}

async function runScript(id, tabId) {
  const store = await chrome.storage.local.get(SCRIPTS_KEY);
  const scripts = Array.isArray(store[SCRIPTS_KEY]) ? store[SCRIPTS_KEY] : [];
  const script = scripts.find((s) => s && s.id === id);
  if (!script || typeof script.code !== "string") {
    return { ok: false, error: "script not found" };
  }
  try {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: runInPage,
      args: [String(script.name || "script"), script.code],
    });
    const result = (frame && frame.result) || { ok: false, error: "no result" };
    if (!result.ok && /unsafe-eval|Content Security Policy/i.test(result.error || "")) {
      return (await runWithUserScripts(tabId, script)) || { ok: false, error: "blocked by the page's Content Security Policy" };
    }
    return result;
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message) {
    return false;
  }

  // Only extension pages (the popup) may run scripts or register a domain.
  // A content script runs inside web pages and must not be able to.
  if (sender.tab) {
    return false;
  }
  if (message.type === "ost:run-script" && typeof message.id === "string") {
    runScript(message.id, message.tabId).then(sendResponse);
    return true;
  }
  if (message.type === "ost:recognize-host") {
    recognizeHost(message.origin, message.tabId).then(sendResponse);
    return true; // async response
  }
  return false;
});

// ------------------------------------------------------------------
// Active / inactive toolbar icon
// ------------------------------------------------------------------

/**
 * "Active" means the same as for the content script: master switch on, and an
 * odoo.com / odoo.sh host or one recognised by hand. It is computed from the
 * hostname alone, so no "tabs" permission is needed to read arbitrary URLs.
 */
async function isHostActive(hostname) {
  if (!hostname) {
    return false;
  }
  const store = await chrome.storage.local.get([SETTINGS_KEY, CUSTOM_HOSTS_KEY]);
  const settings = store[SETTINGS_KEY];
  if (!settings || settings.enabled !== true) {
    return false;
  }
  if (STATIC_ODOO_RE.test(hostname)) {
    return true;
  }
  const hosts = store[CUSTOM_HOSTS_KEY];
  return Array.isArray(hosts) && hosts.includes(hostname);
}

/**
 * An unreadable URL (no permission on that origin) counts as inactive. That
 * is the safe choice, and the content script does not run there anyway.
 */
async function updateActionIcon(tabId, url) {
  if (tabId === undefined || tabId === null) {
    return;
  }
  let hostname = "";
  if (url) {
    try {
      hostname = new URL(url).hostname;
    } catch (err) {
      hostname = "";
    }
  }
  const active = await isHostActive(hostname);
  try {
    await chrome.action.setIcon({ tabId, path: active ? ICON_SETS.active : ICON_SETS.inactive });
  } catch (err) {
    // The tab may have closed in the meantime.
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateActionIcon(tabId, tab && tab.url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      return;
    }
    updateActionIcon(tabId, tab && tab.url);
  });
});

// The master switch or a newly recognised domain changes the "active" state
// of every tab at once, so refresh the icon everywhere.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(SETTINGS_KEY in changes || CUSTOM_HOSTS_KEY in changes)) {
    return;
  }
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      updateActionIcon(tab.id, tab.url);
    }
  });
});
