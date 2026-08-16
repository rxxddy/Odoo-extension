/**
 * Service worker dell'estensione.
 *
 * Il manifest inietta i content script solo su *.odoo.com/*.odoo.sh: una
 * build locale (localhost, un dominio interno, un IP) non li riceve mai. Per
 * quei casi l'utente puo' "riconoscere" il dominio dal popup: qui si chiede
 * il permesso su quell'origine soltanto (mai su tutte le pagine in un colpo
 * solo) e si registra il content script in modo persistente, cosi' torna
 * attivo da solo ad ogni visita successiva senza dover ripetere il gesto.
 */

const BUNDLE = ["shared/defaults.js", "shared/themes.js", "content/content.js"];
const CUSTOM_HOSTS_KEY = "ost_custom_hosts";

function scriptIdFor(origin) {
  // Un id valido per chrome.scripting non puo' contenere ':' o '/'.
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
 * Concede il permesso sull'origine indicata, registra il content script in
 * modo che riparta da solo ai prossimi caricamenti, e lo inietta subito nella
 * scheda attiva cosi' l'effetto si vede senza dover ricaricare.
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

  const id = scriptIdFor(`${url.protocol}//${url.host}`);
  try {
    // Se un'estensione precedente aveva gia' registrato questo stesso
    // dominio, la nuova registrazione fallirebbe per id duplicato: si
    // aggiorna invece di ripetere da capo.
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (existing.length) {
      await chrome.scripting.updateContentScripts([
        { id, matches: [pattern], js: BUNDLE, runAt: "document_start" },
      ]);
    } else {
      await chrome.scripting.registerContentScripts([
        { id, matches: [pattern], js: BUNDLE, runAt: "document_start", persistAcrossSessions: true },
      ]);
    }
  } catch (err) {
    return { ok: false, error: "could not register the script" };
  }

  await rememberHost(url.hostname);

  if (tabId !== undefined && tabId !== null) {
    try {
      // Inietta anche nella scheda gia' aperta: senza, l'effetto si vedrebbe
      // solo dopo un ricaricamento manuale della pagina.
      await chrome.scripting.executeScript({ target: { tabId }, files: BUNDLE });
    } catch (err) {
      // Non fatale: la registrazione persistente coprira' comunque il
      // prossimo caricamento della pagina.
    }
  }

  return { ok: true, hostname: url.hostname };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ost:recognize-host") {
    recognizeHost(message.origin, message.tabId).then(sendResponse);
    return true; // risposta asincrona
  }
  return false;
});

// ------------------------------------------------------------------
// Icona attiva/inattiva sulla barra degli strumenti
// ------------------------------------------------------------------

const STATIC_ODOO_RE = /(^|\.)odoo\.(com|sh)$/i;
const SETTINGS_KEY = "ost_settings";

const ICON_SETS = {
  active: { 16: "icons/icon16_active.png", 32: "icons/icon32_active.png", 48: "icons/icon48_active.png", 128: "icons/icon128_active.png" },
  inactive: { 16: "icons/icon16.png", 32: "icons/icon32.png", 48: "icons/icon48.png", 128: "icons/icon128.png" },
};

/**
 * "Attivo" per l'icona significa la stessa cosa che significa per il content
 * script: interruttore generale acceso, e dominio odoo.com/odoo.sh oppure
 * riconosciuto manualmente. Non si interroga la scheda: e' la stessa
 * condizione che decide se il content script parte, calcolata pero' qui senza
 * bisogno del permesso "tabs" per leggere gli URL di schede arbitrarie.
 */
async function isHostActive(hostname) {
  if (!hostname) {
    return false;
  }
  const store = await chrome.storage.local.get([SETTINGS_KEY, CUSTOM_HOSTS_KEY]);
  const settings = store[SETTINGS_KEY];
  if (settings && settings.enabled === false) {
    return false;
  }
  if (STATIC_ODOO_RE.test(hostname)) {
    return true;
  }
  const hosts = store[CUSTOM_HOSTS_KEY];
  return Array.isArray(hosts) && hosts.includes(hostname);
}

/**
 * Se l'URL non e' leggibile (nessun permesso su quell'origine) lo si tratta
 * da inattivo: e' la scelta piu' prudente, e in pratica su quei domini il
 * content script non gira comunque.
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
    // La scheda puo' essersi gia' chiusa nel frattempo: non c'e' altro da fare.
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

// L'interruttore generale o un nuovo dominio riconosciuto cambiano lo stato
// "attivo" per TUTTE le schede in un colpo solo: si ricalcola l'icona ovunque.
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
