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
  // Domini estranei a *.odoo.com/*.odoo.sh riconosciuti manualmente
  // dall'utente (tipicamente localhost durante lo sviluppo).
  globalThis.OST_KEY_CUSTOM_HOSTS = "ost_custom_hosts";
  globalThis.OST_PROFILE_PREFIX = "ost_profile:";
  globalThis.OST_MEDIA_PREFIX = "ost_media:";
  globalThis.OST_DEFAULT_HOST = "*";
  // Chiave piatta usata fino alla v0.4: serve solo come ripiego in lettura.
  globalThis.OST_LEGACY_MEDIA = "ost_media";

  /**
   * Formati accettati per sfondo immagine e video. Un allow-list esplicito,
   * non il generico `accept="image/*"`: quell'attributo e' solo un filtro del
   * selettore di file, l'utente puo' comunque trascinare o rinominare
   * qualunque cosa, quindi la validazione vera avviene sul MIME effettivo del
   * file scelto (vedi ostAllowedImage/ostAllowedVideo).
   *
   * L'AVI e i contenitori simili restano fuori: la maggior parte dei loro
   * codec non e' decodificabile da un tag <video>, quindi accettarli
   * produrrebbe solo uno sfondo muto e un file inutile in storage.
   */
  globalThis.OST_IMAGE_TYPES = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
  };
  globalThis.OST_VIDEO_TYPES = {
    "video/mp4": [".mp4", ".m4v"],
    "video/webm": [".webm"],
    "video/ogg": [".ogv", ".ogg"],
  };

  function extensionOf(name) {
    const m = /\.[a-z0-9]+$/i.exec(String(name || ""));
    return m ? m[0].toLowerCase() : "";
  }

  /**
   * Verifica combinata su MIME e estensione. Il MIME riportato dal sistema
   * operativo puo' mancare (alcune build Linux non lo popolano): in quel caso
   * si ripiega sull'estensione, che resta un controllo debole ma migliore di
   * un accettazione incondizionata.
   */
  function isAllowed(file, table) {
    if (!file) {
      return false;
    }
    if (file.type && table[file.type]) {
      return true;
    }
    const ext = extensionOf(file.name);
    return Object.values(table).some((exts) => exts.includes(ext));
  }

  globalThis.ostAllowedImage = function (file) {
    return isAllowed(file, globalThis.OST_IMAGE_TYPES);
  };
  globalThis.ostAllowedVideo = function (file) {
    return isAllowed(file, globalThis.OST_VIDEO_TYPES);
  };

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

  globalThis.OST_LABEL_MODES = ["auto", "light", "dark"];
  globalThis.OST_ICON_SIZES = ["l", "m", "s"];
  globalThis.OST_CORNERS = ["tl", "tr", "bl", "br"];
  globalThis.OST_SCREENS = ["appearance", "developer"];

  // Combinazioni valide del costruttore icone.
  globalThis.OST_BG_KEYS = [
    "none", "glass", "smoke", "dark", "black", "light", "white", "paper",
    "aubergine", "teal", "aurora", "sunset", "ocean", "nightfall",
  ];
  globalThis.OST_BORDER_KEYS = [
    "none", "hairline", "dark", "thick", "double", "glow", "halo", "ember", "rgb",
  ];
  globalThis.OST_EFFECT_KEYS = [
    "none", "shadow", "lifted", "pop", "bounce", "wiggle", "spin",
    "greyscale", "invert", "tint", "glow", "flash",
  ];

  /**
   * I temi chiusi delle versioni fino alla 0.9 diventano combinazioni di
   * sfondo/bordo/effetto. Serve a non azzerare l'aspetto gia' scelto quando
   * l'utente aggiorna.
   */
  globalThis.OST_THEME_MIGRATION = {
    off: { iconBackground: "none", iconBorder: "none", iconEffect: "none" },
    glass: { iconBackground: "glass", iconBorder: "none", iconEffect: "none" },
    midnight: { iconBackground: "dark", iconBorder: "none", iconEffect: "shadow" },
    daylight: { iconBackground: "light", iconBorder: "none", iconEffect: "none" },
    rgb: { iconBackground: "dark", iconBorder: "rgb", iconEffect: "none" },
    neon: { iconBackground: "dark", iconBorder: "rgb", iconEffect: "none" },
    aurora: { iconBackground: "aurora", iconBorder: "none", iconEffect: "none" },
    outline: { iconBackground: "none", iconBorder: "hairline", iconEffect: "none" },
    lifted: { iconBackground: "none", iconBorder: "none", iconEffect: "lifted" },
    greyscale: { iconBackground: "none", iconBorder: "none", iconEffect: "greyscale" },
    mono: { iconBackground: "none", iconBorder: "none", iconEffect: "greyscale" },
    paper: { iconBackground: "paper", iconBorder: "none", iconEffect: "none" },
  };

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
    // Ultima sezione aperta nel popup, per riaprirla dov'era rimasto l'utente.
    lastScreen: "appearance",
    // Ritocchi all'interfaccia dell'editor di Odoo.sh: aggiunge la voce
    // "odoo-bin shell" nella barra dei menu di JupyterLab.
    shellUi: false,
  };

  /** Aspetto: memorizzato separatamente per ogni dominio. */
  globalThis.OST_PROFILE_DEFAULTS = {
    // Costruttore icone: tre scelte indipendenti che si combinano.
    iconBackground: "none",
    iconBorder: "none",
    iconEffect: "none",
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
    // Nome del file applicato quando la sorgente e' un caricamento o una
    // cartella: serve a riconoscere quale voce della galleria e' quella attiva.
    imageName: "",
    videoSource: "url",
    videoUrl: "",
    wallpaperDim: 0.25,
    wallpaperBlur: 0,
    // Sfondo a tinta unita o sfumatura a due colori: un terzo tipo di sfondo,
    // indipendente da immagine e video.
    wallpaperColor1: "#242733",
    wallpaperColor2: "#017e84",
    wallpaperGradient: false,
    wallpaperAngle: 135,
    // Esclusione della targhetta, decisa dominio per dominio.
    badgeHidden: false,
  };

  globalThis.OST_MEDIA_DEFAULTS = {
    imageData: "",
    videoData: "",
    videoName: "",
    // Prima immagine del video caricato a mano: senza cronologia da cui
    // pescarla come per i video di cartella, va generata e conservata qui.
    videoThumb: "",
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
    if (!globalThis.OST_SCREENS.includes(g.lastScreen)) {
      g.lastScreen = "appearance";
    }

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
    let legacyTheme = raw && typeof raw.theme === "string" ? raw.theme : "";
    if (legacyTheme === "bare") {
      legacyTheme = "glass";
      p.hideAppNames = true;
    }
    // v0.3: i temi coloravano anche i testi; ora e' un controllo a parte.
    if (raw && !raw.labelColor && legacyTheme) {
      if (["glass", "midnight", "neon", "mono", "bare"].includes(legacyTheme)) {
        p.labelColor = "light";
      } else if (legacyTheme === "daylight") {
        p.labelColor = "dark";
      }
    }
    // v0.9: il tema chiuso diventa una combinazione di sfondo/bordo/effetto.
    // Si applica solo se il profilo non ha gia' i campi nuovi, altrimenti si
    // sovrascriverebbe una scelta fatta con il costruttore.
    if (legacyTheme && !(raw && raw.iconBackground)) {
      const combo = globalThis.OST_THEME_MIGRATION[legacyTheme];
      if (combo) {
        Object.assign(p, combo);
      }
    }

    if (!globalThis.OST_BG_KEYS.includes(p.iconBackground)) {
      p.iconBackground = "none";
    }
    if (!globalThis.OST_BORDER_KEYS.includes(p.iconBorder)) {
      p.iconBorder = "none";
    }
    if (!globalThis.OST_EFFECT_KEYS.includes(p.iconEffect)) {
      p.iconEffect = "none";
    }
    if (!globalThis.OST_LABEL_MODES.includes(p.labelColor)) {
      p.labelColor = "auto";
    }
    if (!globalThis.OST_ICON_SIZES.includes(p.iconSize)) {
      p.iconSize = "l";
    }
    p.wallpaperKind = ["video", "color"].includes(p.wallpaperKind) ? p.wallpaperKind : "image";
    p.wallpaperDim = Math.min(0.8, Math.max(0, Number(p.wallpaperDim) || 0));
    p.wallpaperBlur = Math.min(24, Math.max(0, Number(p.wallpaperBlur) || 0));
    if (!/^#[0-9a-f]{6}$/i.test(String(p.wallpaperColor1))) {
      p.wallpaperColor1 = globalThis.OST_PROFILE_DEFAULTS.wallpaperColor1;
    }
    if (!/^#[0-9a-f]{6}$/i.test(String(p.wallpaperColor2))) {
      p.wallpaperColor2 = globalThis.OST_PROFILE_DEFAULTS.wallpaperColor2;
    }
    p.wallpaperGradient = !!p.wallpaperGradient;
    p.wallpaperAngle = ((Math.round(Number(p.wallpaperAngle)) % 360) + 360) % 360;
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
    // "folder" e' un'origine legittima quanto "url" e "file": il dato vero e
    // proprio arriva comunque incorporato in `data`, la provenienza serve solo
    // a scegliere l'icona e a nascondere il cestino nella libreria.
    return raw.filter((e) => e && e.id && (e.url || e.data));
  };

  globalThis.ostNormalizeCustomHosts = function (raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    return [...new Set(raw.filter((h) => typeof h === "string" && h))];
  };

  // ------------------------------------------------------------------
  // Riconoscimento dell'ambiente
  // ------------------------------------------------------------------

  /**
   * Un dominio e' trattato come Odoo se rientra in *.odoo.com/*.odoo.sh
   * oppure se l'utente lo ha riconosciuto manualmente (tipicamente un'istanza
   * locale, dove il nome non dice nulla sull'ambiente). L'elenco manuale va
   * passato esplicitamente: questa funzione non legge da sola lo storage,
   * cosi' resta utilizzabile allo stesso modo nel content script e nel popup.
   */
  // Regex condivisa: sia il riconoscimento automatico sia il banner di
  // riconoscimento manuale nel popup devono concordare su cosa conta come
  // "gia' un dominio Odoo standard".
  globalThis.OST_STATIC_ODOO_RE = /(^|\.)odoo\.(com|sh)$/i;

  globalThis.ostIsOdooHost = function (hostname, customHosts) {
    const host = String(hostname || "");
    if (globalThis.OST_STATIC_ODOO_RE.test(host)) {
      return true;
    }
    return Array.isArray(customHosts) && customHosts.includes(host);
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
  globalThis.ostHostEnvironment = function (hostname, customHosts) {
    const host = String(hostname || "").toLowerCase();
    if (!globalThis.ostIsOdooHost(host, customHosts)) {
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
