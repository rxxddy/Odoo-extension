/**
 * Configurazione condivisa tra content script e popup.
 *
 * Lo storage e' diviso per ambito, cosi' ogni pagina legge solo cio' che le
 * serve e nessuna scrittura trascina dati pesanti:
 *
 *  - ost_settings          globale: interruttori validi su tutti i progetti;
 *  - ost_profile:<host>    aspetto memorizzato per singolo dominio;
 *  - ost_profile:*         profilo di riferimento per i domini mai personalizzati;
 *  - ost_media:<host>      sfondo attivo di quel dominio (immagine o video);
 *  - ost_library           cronologia degli sfondi, letta unicamente dal popup.
 *
 * Le chiavi per dominio sono separate di proposito: il content script chiede
 * soltanto quelle del proprio host, quindi aprire una scheda non costringe il
 * browser a caricare gli sfondi di tutti gli altri progetti.
 */
(function () {
  "use strict";

  globalThis.OST_KEY_SETTINGS = "ost_settings";
  globalThis.OST_KEY_LIBRARY = "ost_library";
  globalThis.OST_PROFILE_PREFIX = "ost_profile:";
  globalThis.OST_MEDIA_PREFIX = "ost_media:";
  globalThis.OST_DEFAULT_HOST = "*";
  // Chiave piatta usata fino alla v0.4: serve solo come ripiego in lettura.
  globalThis.OST_LEGACY_MEDIA = "ost_media";

  globalThis.ostProfileKey = function (host) {
    return globalThis.OST_PROFILE_PREFIX + (host || globalThis.OST_DEFAULT_HOST);
  };
  globalThis.ostMediaKey = function (host) {
    return globalThis.OST_MEDIA_PREFIX + (host || globalThis.OST_DEFAULT_HOST);
  };

  // Oltre questa soglia un video non viene accettato: si invita l'utente a
  // usare un link. Un data URL piu' grande renderebbe lento ogni avvio.
  globalThis.OST_MAX_VIDEO_BYTES = 24 * 1024 * 1024;
  globalThis.OST_LIBRARY_LIMIT = 24;
  globalThis.OST_RECENT_COUNT = 5;

  globalThis.OST_THEMES = [
    "off", "glass", "midnight", "daylight", "rgb",
    "aurora", "outline", "lifted", "greyscale", "paper",
  ];
  globalThis.OST_LABEL_MODES = ["auto", "light", "dark"];
  globalThis.OST_ICON_SIZES = ["l", "m", "s"];
  globalThis.OST_CORNERS = ["tl", "tr", "bl", "br"];

  // Colori usati quando la targhetta e' impostata su "auto": rosso per la
  // produzione, ambra per lo staging, verde per gli ambienti usa e getta.
  globalThis.OST_ENV_COLORS = {
    PROD: "#d0442c",
    STAGING: "#c9761e",
    DEV: "#1f7a4d",
  };

  globalThis.OST_PALETTE = [
    "#d0442c", "#c9761e", "#1f7a4d", "#017e84",
    "#714b67", "#2f6fb0", "#4a4f5e", "#111318",
  ];

  /** Interruttori globali: valgono su ogni progetto. */
  globalThis.OST_GLOBAL_DEFAULTS = {
    enabled: true,
    hideTrialBanner: true,
    hideNeutralizeBanner: false,
    debugMode: false,
    badgeEnabled: true,
    badgeCorner: "tr",
    badgeSize: 12,
    badgeColor: "auto", // "auto" oppure un colore esadecimale
    // Copia del nome tecnico di un campo cliccandone l'etichetta.
    copyFieldNames: true,
  };

  /** Aspetto: memorizzato separatamente per ogni dominio. */
  globalThis.OST_PROFILE_DEFAULTS = {
    theme: "off",
    labelColor: "auto",
    hideAppNames: false,
    roundIconsEnabled: true,
    iconRadius: 18,
    // Dimensione del disegno dentro l'icona: la cornice non cambia mai misura.
    iconSize: "l",
    wallpaperEnabled: false,
    wallpaperKind: "image",
    imageSource: "url",
    imageUrl: "",
    videoSource: "url",
    videoUrl: "",
    wallpaperDim: 0.25,
    wallpaperBlur: 0,
    // Esclusione della targhetta, decisa dominio per dominio.
    badgeHidden: false,
  };

  globalThis.OST_MEDIA_DEFAULTS = {
    imageData: "",
    videoData: "",
    videoName: "",
  };

  /**
   * Fino alla v0.4 tutto stava in un unico record piatto. Le funzioni di
   * normalizzazione accettano quel record cosi' com'e': se le chiavi nuove non
   * esistono ancora, i valori vecchi vengono letti dallo stesso oggetto e
   * l'utente non perde nulla all'aggiornamento.
   */
  globalThis.ostNormalizeGlobal = function (raw) {
    const g = Object.assign({}, globalThis.OST_GLOBAL_DEFAULTS, raw || {});

    // v0.1: autoDebug era una stringa con i livelli di debug.
    if (raw && typeof raw.autoDebug === "string") {
      g.debugMode = raw.autoDebug !== "off";
    }
    if (!globalThis.OST_CORNERS.includes(g.badgeCorner)) {
      g.badgeCorner = "tr";
    }
    if (g.badgeColor !== "auto" && !/^#[0-9a-f]{6}$/i.test(String(g.badgeColor))) {
      g.badgeColor = "auto";
    }
    g.badgeSize = Math.min(22, Math.max(9, Number(g.badgeSize) || 12));
    g.enabled = g.enabled !== false;

    // Ripulisce le chiavi non piu' pertinenti ereditate dal record piatto.
    for (const key of Object.keys(g)) {
      if (!(key in globalThis.OST_GLOBAL_DEFAULTS)) {
        delete g[key];
      }
    }
    return g;
  };

  globalThis.ostNormalizeProfile = function (raw) {
    const p = Object.assign({}, globalThis.OST_PROFILE_DEFAULTS, raw || {});

    // v0.1: un solo sfondo, sempre immagine.
    if (raw && typeof raw.wallpaperSource === "string" && !raw.imageSource) {
      p.imageSource = raw.wallpaperSource === "file" ? "file" : "url";
    }
    if (raw && typeof raw.wallpaperUrl === "string" && !raw.imageUrl) {
      p.imageUrl = raw.wallpaperUrl;
    }
    // v0.2: il tema "bare" e' diventato l'interruttore delle didascalie.
    if (p.theme === "bare") {
      p.theme = "glass";
      p.hideAppNames = true;
    }
    // v0.3: i temi coloravano anche i testi; ora e' un controllo a parte.
    if (raw && !raw.labelColor && typeof raw.theme === "string") {
      if (["glass", "midnight", "neon", "mono", "bare"].includes(raw.theme)) {
        p.labelColor = "light";
      } else if (raw.theme === "daylight") {
        p.labelColor = "dark";
      }
    }
    if (p.theme === "neon") {
      p.theme = "rgb";
    }
    if (p.theme === "mono") {
      p.theme = "greyscale";
    }

    if (!globalThis.OST_THEMES.includes(p.theme)) {
      p.theme = "off";
    }
    if (!globalThis.OST_LABEL_MODES.includes(p.labelColor)) {
      p.labelColor = "auto";
    }
    if (!globalThis.OST_ICON_SIZES.includes(p.iconSize)) {
      p.iconSize = "l";
    }
    p.wallpaperKind = p.wallpaperKind === "video" ? "video" : "image";
    p.wallpaperDim = Math.min(0.8, Math.max(0, Number(p.wallpaperDim) || 0));
    p.wallpaperBlur = Math.min(24, Math.max(0, Number(p.wallpaperBlur) || 0));
    p.iconRadius = Math.min(34, Math.max(0, Number(p.iconRadius) || 0));

    for (const key of Object.keys(p)) {
      if (!(key in globalThis.OST_PROFILE_DEFAULTS)) {
        delete p[key];
      }
    }
    return p;
  };

  globalThis.ostNormalizeMedia = function (raw) {
    const m = Object.assign({}, globalThis.OST_MEDIA_DEFAULTS, raw || {});
    // v0.1: l'immagine caricata stava dentro al record delle impostazioni.
    if (!m.imageData && raw && typeof raw.wallpaperData === "string") {
      m.imageData = raw.wallpaperData;
    }
    return m;
  };

  globalThis.ostNormalizeLibrary = function (raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((e) => e && e.id && (e.url || e.data));
  };

  // ------------------------------------------------------------------
  // Riconoscimento dell'ambiente
  // ------------------------------------------------------------------

  globalThis.ostIsOdooHost = function (hostname) {
    return /(^|\.)odoo\.(com|sh)$/i.test(String(hostname || ""));
  };

  /**
   * Ambiente deducibile dal solo hostname.
   *
   * Non ci si puo' basare su ".dev." per riconoscere uno sviluppo: su Odoo.sh
   * tutti i rami, produzione compresa, vivono sotto `.dev.odoo.com`. Lo
   * sviluppo si riconosce dal banner nella pagina, non dall'indirizzo.
   * Il dominio nudo `odoo.com` e il suo `www` non ricevono targhetta: non sono
   * un database di nessuno.
   */
  globalThis.ostHostEnvironment = function (hostname) {
    const host = String(hostname || "").toLowerCase();
    if (!globalThis.ostIsOdooHost(host)) {
      return "";
    }
    if (/staging/.test(host)) {
      return "STAGING";
    }
    const labels = host.split(".");
    const base = labels.slice(-2).join("."); // odoo.com oppure odoo.sh
    const sub = labels.slice(0, -2).filter((l) => l && l !== "www");
    if (!sub.length) {
      return "";
    }
    return base === "odoo.sh" ? "" : "PROD";
  };

  /** Bianco o quasi nero, in base alla luminanza del colore scelto. */
  globalThis.ostContrastInk = function (hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) {
      return "#ffffff";
    }
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? "#1b1e29" : "#ffffff";
  };
})();
