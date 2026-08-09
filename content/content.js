/**
 * UI Enhancer for Odoo - content script.
 *
 * Gira a document_start: <body> non esiste ancora, quindi ogni accesso al DOM
 * applicativo va differito. I blocchi (stile, banner, debug, sfondo video) sono
 * indipendenti: il fallimento di uno non pregiudica gli altri.
 */
(function () {
  "use strict";

  const STYLE_ID = "ost-injected-style";
  const LAYER_ID = "ost-media-layer";
  const VIDEO_ON_CLASS = "ost-video-on";
  // Flag di sessione: evita un loop di redirect se il server non onora il
  // parametro debug (utente non interno, sessione senza permessi, ecc.).
  const DEBUG_FLAG = "ost:debug-attempted";

  const HOST = window.location.hostname;
  // Interruttori validi ovunque.
  let settings = globalThis.ostNormalizeGlobal(null);
  // Aspetto memorizzato per questo dominio.
  let profile = globalThis.ostNormalizeProfile(null);
  let media = globalThis.ostNormalizeMedia(null);
  let currentEnv = "";
  let domObserver = null;
  let bodyClassObserver = null;
  let videoObjectUrl = "";
  // Sorgente attualmente montata nel tag <video>: serve a capire se il livello
  // va ricostruito o se basta aggiornare il CSS.
  let mountedVideoSource = "";
  // Richiesta di debug arrivata mentre la scheda era in secondo piano.
  let pendingDebug = false;

  // ------------------------------------------------------------------
  // Utilita'
  // ------------------------------------------------------------------

  /** Rende sicuro un URL dentro una dichiarazione CSS url("..."). */
  function cssUrl(value) {
    if (!value) {
      return "";
    }
    if (value.startsWith("data:")) {
      return `url("${value}")`;
    }
    const safe = String(value).replace(/["'()\\\s]/g, encodeURIComponent);
    return `url("${safe}")`;
  }

  function activeImage() {
    if (profile.imageSource === "file") {
      return media.imageData;
    }
    return profile.imageUrl;
  }

  function activeVideo() {
    if (profile.videoSource === "file") {
      return media.videoData;
    }
    return profile.videoUrl;
  }

  function wallpaperMode() {
    if (!profile.wallpaperEnabled) {
      return "none";
    }
    if (profile.wallpaperKind === "video") {
      return activeVideo() ? "video" : "none";
    }
    return activeImage() ? "image" : "none";
  }

  // ------------------------------------------------------------------
  // 1. Iniezione CSS
  // ------------------------------------------------------------------

  function buildCss() {
    const chunks = [];
    if (!settings.enabled) {
      return "";
    }
    const mode = wallpaperMode();
    const dim = Number(profile.wallpaperDim) || 0;
    const blur = Number(profile.wallpaperBlur) || 0;

    if (mode === "image") {
      const url = cssUrl(activeImage());
      // Il gradiente costante fa da velo scurente: sta prima dell'immagine
      // nello stack di background-image, quindi viene disegnato sopra.
      const veil = dim > 0
        ? `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), `
        : "";

      chunks.push(`
        body.o_home_menu_background {
          background-image: ${veil}${url} !important;
          background-size: cover !important;
          background-position: center center !important;
          background-repeat: no-repeat !important;
          background-attachment: fixed !important;
        }
        body.o_home_menu_background .o_home_menu {
          background-image: none !important;
          background-color: transparent !important;
        }
      `);

      if (blur > 0) {
        // La sfocatura non puo' agire sul background di body senza coinvolgere
        // i figli: si usa uno pseudo-elemento dedicato dietro al contenuto,
        // cosi' l'interfaccia resta nitida.
        chunks.push(`
          body.o_home_menu_background { background-image: none !important; }
          body.o_home_menu_background::before {
            content: "";
            position: fixed;
            inset: -${blur * 2}px;
            z-index: -1;
            background-image: ${veil}${url};
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
            filter: blur(${blur}px);
            pointer-events: none;
          }
        `);
      }
    }

    if (mode === "video") {
      chunks.push(`
        body.${VIDEO_ON_CLASS}.o_home_menu_background {
          background-image: none !important;
          background-color: transparent !important;
        }
        body.${VIDEO_ON_CLASS}.o_home_menu_background .o_home_menu {
          background-image: none !important;
          background-color: transparent !important;
        }
        #${LAYER_ID} {
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          pointer-events: none;
        }
        body:not(.o_home_menu_background) #${LAYER_ID} { display: none; }
        #${LAYER_ID} video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          ${blur > 0 ? `filter: blur(${blur}px); transform: scale(1.12);` : ""}
        }
        #${LAYER_ID} .ost-media-veil {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, ${dim});
        }
      `);
    }

    if (currentEnv) {
      chunks.push(globalThis.ostBadgeCss(settings, currentEnv));
    }

    chunks.push(globalThis.ostThemeCss(profile.theme));
    chunks.push(globalThis.ostLabelCss(profile.labelColor));

    if (profile.hideAppNames) {
      chunks.push(globalThis.ostNoLabelsCss());
    }
    // Dopo il tema, cosi' la misura scelta prevale sul padding della cornice.
    chunks.push(globalThis.ostIconSizeCss(profile.iconSize));

    if (settings.copyFieldNames) {
      chunks.push(globalThis.ostToastCss());
    }

    if (profile.roundIconsEnabled) {
      const r = Number(profile.iconRadius) || 0;
      chunks.push(`
        body.o_home_menu_background .o_app_icon,
        .o_app_icon.rounded-3,
        .o_app_icon {
          border-radius: ${r}px !important;
        }
        .o_burger_menu_avatar,
        .o_user_avatar.o_avatar {
          border-radius: ${Math.min(r, 12)}px !important;
        }
      `);
    }

    // Rispetta la preferenza di sistema: nessuna animazione sulle icone.
    chunks.push(`
      @media (prefers-reduced-motion: reduce) {
        body.o_home_menu_background .o_apps .o_app_icon,
        body.o_home_menu_background .o_apps .o_app.o_menuitem {
          transition: none !important;
        }
      }
    `);

    return chunks.filter(Boolean).join("\n");
  }

  function applyCss() {
    const css = buildCss();
    let node = document.getElementById(STYLE_ID);

    if (!css) {
      if (node) {
        node.remove();
      }
      return;
    }
    if (!node) {
      node = document.createElement("style");
      node.id = STYLE_ID;
      // A document_start head puo' essere null: documentElement esiste sempre.
      (document.head || document.documentElement).appendChild(node);
    }
    node.textContent = css;
  }

  // ------------------------------------------------------------------
  // 2. Livello video
  // ------------------------------------------------------------------

  function releaseObjectUrl() {
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      videoObjectUrl = "";
    }
  }

  function removeVideoLayer() {
    const layer = document.getElementById(LAYER_ID);
    if (layer) {
      const video = layer.querySelector("video");
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      layer.remove();
    }
    releaseObjectUrl();
    mountedVideoSource = "";
    if (document.body) {
      document.body.classList.remove(VIDEO_ON_CLASS);
    }
  }

  /**
   * Un data URL da decine di MB come attributo src bloccherebbe il parser e
   * impedirebbe al browser di gestire il buffering: lo si converte in Blob e
   * si usa un object URL, che il video legge in streaming.
   */
  async function resolveVideoSrc() {
    releaseObjectUrl();
    const source = activeVideo();
    if (!source) {
      return "";
    }
    if (!source.startsWith("data:")) {
      return source;
    }
    const blob = await (await fetch(source)).blob();
    videoObjectUrl = URL.createObjectURL(blob);
    return videoObjectUrl;
  }

  async function ensureVideoLayer() {
    if (!document.body) {
      return;
    }
    if (document.getElementById(LAYER_ID)) {
      return;
    }

    const layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.setAttribute("aria-hidden", "true");

    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.disablePictureInPicture = true;
    video.setAttribute("disableremoteplayback", "");
    // Se la sorgente non e' riproducibile si torna allo sfondo originale di
    // Odoo invece di lasciare la pagina vuota.
    video.addEventListener("error", removeVideoLayer, { once: true });

    const veil = document.createElement("div");
    veil.className = "ost-media-veil";

    layer.appendChild(video);
    layer.appendChild(veil);
    // Primo figlio di body: con z-index negativo resta dietro a tutto il
    // contenuto applicativo senza entrare nel flusso.
    document.body.insertBefore(layer, document.body.firstChild);
    document.body.classList.add(VIDEO_ON_CLASS);

    try {
      mountedVideoSource = activeVideo();
      video.src = await resolveVideoSrc();
    } catch (err) {
      removeVideoLayer();
      return;
    }
    syncVideoPlayback();
  }

  /** Ferma il video quando non e' visibile: scheda in background o app aperta. */
  /** Il debug rinviato perche' la scheda era nascosta viene ripreso qui. */
  function resumePendingDebug() {
    if (pendingDebug && !document.hidden) {
      pendingDebug = false;
      maybeEnableDebug(true);
    }
  }

  function syncVideoPlayback() {
    const video = document.querySelector(`#${LAYER_ID} video`);
    if (!video || !document.body) {
      return;
    }
    const visible =
      !document.hidden && document.body.classList.contains("o_home_menu_background");

    if (visible) {
      const promise = video.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {
          // L'autoplay puo' essere rifiutato: il fotogramma resta comunque
          // visibile, quindi non e' un errore da propagare.
        });
      }
    } else {
      video.pause();
    }
  }

  function applyMediaLayer() {
    if (wallpaperMode() !== "video") {
      removeVideoLayer();
      return;
    }
    if (mountedVideoSource && mountedVideoSource !== activeVideo()) {
      removeVideoLayer();
    }
    ensureVideoLayer();
  }

  // ------------------------------------------------------------------
  // 3. Banner trial / staging di Odoo.sh
  // ------------------------------------------------------------------

  const TRIAL_PATTERNS = [
    /odoo\.sh trial project/i,
    /temporary odoo\.sh (staging|development) environment/i,
    /will be automatically deleted on/i,
    /typically lasts between \d+\s*(and|e)\s*\d+ hours/i,
    /(trial|staging|development) databases are not backed up/i,
    /questo database.*(prova|staging)/i,
  ];

  // Pannelli di scadenza gia' identificabili per selettore.
  const EXPIRY_SELECTORS = [
    ".o_expired_panel",
    ".database_expiration_panel",
    ".oe_instance_register",
  ];

  function looksLikeTrialNotice(el) {
    const text = el.textContent || "";
    if (text.length > 800) {
      // Un contenitore troppo grande e' quasi certamente un antenato:
      // nasconderlo cancellerebbe mezza pagina.
      return false;
    }
    return TRIAL_PATTERNS.some((re) => re.test(text));
  }

  /**
   * Risale dall'alert al contenitore da nascondere davvero. Odoo a volte
   * avvolge il messaggio in un overlay assoluto a tutto schermo che intercetta
   * i click: nascondere solo l'alert lascerebbe la pagina sotto un velo
   * invisibile e non cliccabile.
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
      const isOverlay =
        /position\s*:\s*(absolute|fixed)/i.test(style) && /z-index/i.test(style);
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

  /**
   * Banner rosso dei database neutralizzati. Ha un id proprio, quindi non
   * serve cercarlo per testo. Resta un interruttore distinto da quello del
   * trial: segnala che il database non invia e-mail reali, ed e' una garanzia
   * che molti preferiscono tenere sotto gli occhi.
   */
  function hideNeutralizeBanner() {
    if (!settings.enabled || !settings.hideNeutralizeBanner || !document.body) {
      return;
    }
    const el = document.getElementById("oe_neutralize_banner");
    if (!el || el.dataset.ostHidden === "1") {
      return;
    }
    const target = resolveHideTarget(el);
    target.dataset.ostHidden = "1";
    target.style.setProperty("display", "none", "important");
  }

  function hideTrialBanners() {
    if (!settings.enabled || !settings.hideTrialBanner || !document.body) {
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
      if (!isExpiryPanel && !looksLikeTrialNotice(el)) {
        continue;
      }
      const target = resolveHideTarget(el);
      target.dataset.ostHidden = "1";
      target.style.setProperty("display", "none", "important");
    }
  }

  /**
   * Rimette in pagina cio' che non deve piu' restare nascosto. Ogni elemento
   * porta il motivo per cui era stato tolto, cosi' spegnere un interruttore
   * non fa ricomparire anche i banner governati dall'altro.
   */
  function restoreHiddenBanners() {
    if (!document.body) {
      return;
    }
    const keepTrial = settings.enabled && settings.hideTrialBanner;
    const keepNeutralize = settings.enabled && settings.hideNeutralizeBanner;

    for (const el of document.querySelectorAll('[data-ost-hidden="1"]')) {
      const isNeutralize = el.id === "oe_neutralize_banner" || el.querySelector("#oe_neutralize_banner");
      if (isNeutralize ? keepNeutralize : keepTrial) {
        continue;
      }
      el.style.removeProperty("display");
      delete el.dataset.ostHidden;
    }
  }

  function startObservers() {
    if (!document.body) {
      return;
    }
    // Odoo e' una SPA: il banner viene ri-renderizzato ad ogni cambio vista,
    // quindi un singolo passaggio all'avvio non basta.
    if (!domObserver) {
      domObserver = new MutationObserver(() => {
        hideTrialBanners();
        hideNeutralizeBanner();
        applyBadge();
        if (wallpaperMode() === "video") {
          ensureVideoLayer();
        }
      });
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Osservatore separato e senza subtree: le classi di body cambiano solo
    // entrando e uscendo dal menu principale, mentre il DOM interno muta di
    // continuo. Tenerli distinti evita di eseguire la logica del video a ogni
    // singola mutazione della pagina.
    if (!bodyClassObserver) {
      bodyClassObserver = new MutationObserver(syncVideoPlayback);
      bodyClassObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  // ------------------------------------------------------------------
  // 3b. Targhetta dell'ambiente
  // ------------------------------------------------------------------

  const DEV_PATTERNS = [
    /temporary odoo\.sh development environment/i,
    /development databases are not backed up/i,
  ];

  /** Lo sviluppo si riconosce dal banner: l'indirizzo non lo distingue. */
  function hasDevBanner() {
    for (const el of document.querySelectorAll(".alert")) {
      const text = el.textContent || "";
      if (text.length <= 800 && DEV_PATTERNS.some((re) => re.test(text))) {
        return true;
      }
    }
    return false;
  }

  function detectEnvironment() {
    if (!settings.enabled || !settings.badgeEnabled || profile.badgeHidden) {
      return "";
    }
    // Una volta riconosciuto lo sviluppo il verdetto non cambia piu': si evita
    // di riesaminare gli alert ad ogni mutazione del DOM.
    if (currentEnv === "DEV") {
      return "DEV";
    }
    if (document.body && hasDevBanner()) {
      return "DEV";
    }
    return globalThis.ostHostEnvironment(HOST);
  }

  function applyBadge() {
    const env = detectEnvironment();
    const existing = document.getElementById("ost-env-badge");

    if (!env) {
      currentEnv = "";
      if (existing) {
        existing.remove();
      }
      return;
    }
    const changed = env !== currentEnv;
    currentEnv = env;

    if (!document.body) {
      return;
    }
    if (!existing) {
      const badge = document.createElement("div");
      badge.id = "ost-env-badge";
      badge.textContent = env;
      badge.setAttribute("role", "status");
      document.body.appendChild(badge);
    } else if (existing.textContent !== env) {
      existing.textContent = env;
    }
    if (changed) {
      // Il colore in modalita' automatica dipende dall'ambiente: se il verdetto
      // cambia, il foglio di stile va rigenerato.
      applyCss();
    }
  }

  // ------------------------------------------------------------------
  // 4. Modalita' sviluppatore
  // ------------------------------------------------------------------

  function maybeEnableDebug(force) {
    if (!settings.enabled || !settings.debugMode || !document.body) {
      return;
    }
    // Agiamo solo dentro al web client: fuori (login, portale, sito) il
    // parametro non ha senso.
    if (!document.body.classList.contains("o_web_client")) {
      return;
    }
    // data-odoo-debug-mode e' l'unica fonte affidabile: window.odoo appartiene
    // al main world e non e' leggibile da un content script.
    if (document.body.dataset.odooDebugMode) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has("debug")) {
      return;
    }
    // Una scheda in secondo piano non viene ricaricata sotto il naso
    // dell'utente: il redirect aspetta che torni in primo piano.
    if (document.hidden) {
      pendingDebug = true;
      return;
    }
    try {
      // Il flag esiste per non ripetere il tentativo ad ogni caricamento; se e'
      // l'utente ad accendere l'interruttore adesso, va scavalcato.
      if (!force && window.sessionStorage.getItem(DEBUG_FLAG)) {
        return;
      }
      window.sessionStorage.setItem(DEBUG_FLAG, "1");
    } catch (err) {
      // Senza sessionStorage rinunciamo al redirect piuttosto che rischiare
      // un ciclo infinito di ricaricamenti.
      return;
    }

    url.searchParams.set("debug", "1");
    window.location.replace(url.toString());
  }

  // ------------------------------------------------------------------
  // 5. Nome del database, per il popup
  // ------------------------------------------------------------------

  function readDatabaseName() {
    // Odoo lo mostra sotto il nome utente, in monospazio, dentro un <mark>.
    const mark = document.querySelector(".oe_topbar_name mark, .o_user_menu mark");
    const name = mark ? mark.textContent.trim() : "";
    return name || "";
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "ost:database") {
      sendResponse({
        database: readDatabaseName(),
        host: HOST,
        // Il verdetto sull'ambiente nasce qui, dove si vedono i banner: il
        // popup lo mostra senza doverlo ricalcolare a modo suo.
        environment: currentEnv || globalThis.ostHostEnvironment(HOST),
      });
    }
    return false;
  });

  // ------------------------------------------------------------------
  // 5b. Copia del nome tecnico di un campo
  // ------------------------------------------------------------------

  /*
   * In modalita' sviluppatore Odoo appende ad ogni campo un `data-tooltip-info`
   * con il nome tecnico. L'attributo non sta pero' sempre sullo stesso
   * elemento: nei form e' su un `<sup>` dentro alla `<label>`, negli elenchi su
   * un `<div>` dentro al `<th>`. Si parte quindi dall'ancora cliccabile e si
   * cerca l'attributo su di essa o al suo interno, invece di inseguire una
   * struttura fissa che cambia da vista a vista.
   */
  const LABEL_ANCHORS = "label, th, .o_form_label, .o_horizontal_separator";
  let toastTimer = null;

  function readFieldName(target) {
    // Un click sul testo puo' arrivare come nodo di testo: si risale all'elemento.
    const node = target && target.nodeType === 3 ? target.parentElement : target;
    if (!node || !node.closest) {
      return "";
    }
    const anchor = node.closest(LABEL_ANCHORS);
    if (!anchor) {
      return "";
    }
    const holder = anchor.matches("[data-tooltip-info]")
      ? anchor
      : anchor.querySelector("[data-tooltip-info]");
    if (!holder) {
      return "";
    }
    try {
      const info = JSON.parse(holder.getAttribute("data-tooltip-info"));
      return (info && info.field && info.field.name) || "";
    } catch (err) {
      return "";
    }
  }

  function showToast(text) {
    let toast = document.getElementById("ost-copy-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ost-copy-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 2000);
  }

  /**
   * `navigator.clipboard` puo' essere negato in un content script: il ripiego
   * con un campo temporaneo funziona ovunque, quindi la copia non fallisce in
   * silenzio.
   */
  function copyText(text) {
    const fallback = () => {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        /* niente da fare: si evita comunque di rompere il click */
      }
      field.remove();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
  }

  function onLabelClick(event) {
    if (!settings.enabled || !settings.copyFieldNames) {
      return;
    }
    const name = readFieldName(event.target);
    if (!name) {
      return;
    }
    // Nessun preventDefault: cliccando una `<label>` il campo collegato deve
    // continuare a ricevere il fuoco come sempre.
    copyText(name);
    showToast("Copied");
  }

  // ------------------------------------------------------------------
  // Orchestrazione
  // ------------------------------------------------------------------

  function applyAll() {
    applyBadge();
    applyCss();
    applyMediaLayer();
    if (settings.enabled && (settings.hideTrialBanner || settings.hideNeutralizeBanner)) {
      hideTrialBanners();
      hideNeutralizeBanner();
    }
    // Cio' che l'utente ha appena disattivato torna visibile subito, senza
    // dover ricaricare la pagina.
    if (!settings.enabled || !settings.hideTrialBanner || !settings.hideNeutralizeBanner) {
      restoreHiddenBanners();
    }
    startObservers();
  }

  function onDomReady() {
    applyAll();
    maybeEnableDebug();
    // Un solo ascoltatore sul documento: le viste di Odoo si ricostruiscono di
    // continuo e agganciare ogni etichetta sarebbe da rifare ad ogni render.
    document.addEventListener("click", onLabelClick, true);
    document.addEventListener("visibilitychange", () => {
      syncVideoPlayback();
      resumePendingDebug();
    });
  }

  const PROFILE_KEY = globalThis.ostProfileKey(HOST);
  const DEFAULT_PROFILE_KEY = globalThis.ostProfileKey(globalThis.OST_DEFAULT_HOST);
  const MEDIA_KEY = globalThis.ostMediaKey(HOST);
  const DEFAULT_MEDIA_KEY = globalThis.ostMediaKey(globalThis.OST_DEFAULT_HOST);

  /**
   * Il record piatto della v0.4 fa da ultimo ripiego: finche' il popup non ha
   * scritto i profili nuovi, l'aspetto scelto in precedenza continua a valere.
   */
  function readState(record) {
    const legacy = record[globalThis.OST_KEY_SETTINGS];
    settings = globalThis.ostNormalizeGlobal(legacy);
    profile = globalThis.ostNormalizeProfile(
      record[PROFILE_KEY] || record[DEFAULT_PROFILE_KEY] || legacy
    );
    media = globalThis.ostNormalizeMedia(
      record[MEDIA_KEY] || record[DEFAULT_MEDIA_KEY] || record[globalThis.OST_LEGACY_MEDIA]
    );
  }

  chrome.storage.local.get(
    [
      globalThis.OST_KEY_SETTINGS,
      PROFILE_KEY,
      DEFAULT_PROFILE_KEY,
      MEDIA_KEY,
      DEFAULT_MEDIA_KEY,
      globalThis.OST_LEGACY_MEDIA,
    ],
    (record) => {
      readState(record || {});
      applyCss();

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
      } else {
        onDomReady();
      }
    }
  );

  // Aggiornamento dal vivo: il popup non deve ricaricare la pagina.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    // Solo le chiavi che riguardano questo dominio: le personalizzazioni degli
    // altri progetti non devono far ridisegnare nulla qui.
    const relevant = [
      globalThis.OST_KEY_SETTINGS,
      PROFILE_KEY,
      DEFAULT_PROFILE_KEY,
      MEDIA_KEY,
      DEFAULT_MEDIA_KEY,
      globalThis.OST_LEGACY_MEDIA,
    ].filter((key) => key in changes);

    if (!relevant.length) {
      return;
    }
    const before = settings.debugMode;
    const beforeMedia = activeVideo();

    chrome.storage.local.get(
      [
        globalThis.OST_KEY_SETTINGS,
        PROFILE_KEY,
        DEFAULT_PROFILE_KEY,
        MEDIA_KEY,
        DEFAULT_MEDIA_KEY,
        globalThis.OST_LEGACY_MEDIA,
      ],
      (record) => {
        readState(record || {});
        if (beforeMedia !== activeVideo()) {
          // La sorgente e' cambiata: il livello va ricostruito da zero.
          removeVideoLayer();
        }
        applyAll();
        // L'interruttore appena acceso deve agire subito, non al prossimo
        // caricamento: si forza il tentativo scavalcando il flag di sessione.
        if (!before && settings.debugMode) {
          maybeEnableDebug(true);
        }
      }
    );
  });

})();
