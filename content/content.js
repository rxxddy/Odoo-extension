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
    // "folder" e "file" arrivano entrambi gia' incorporati in media.imageData:
    // per il livello CSS non c'e' differenza, la provenienza serve solo al
    // popup per scegliere l'icona da mostrare nella libreria.
    if (profile.imageSource === "file" || profile.imageSource === "folder") {
      return media.imageData;
    }
    return profile.imageUrl;
  }

  function activeVideo() {
    if (profile.videoSource === "file" || profile.videoSource === "folder") {
      return media.videoData;
    }
    return profile.videoUrl;
  }

  function wallpaperMode() {
    // L'interruttore generale ha la precedenza su tutto: senza questo
    // controllo il livello video e la classe sul body restavano in pagina
    // anche a estensione spenta.
    if (!settings.enabled || !profile.wallpaperEnabled) {
      return "none";
    }
    if (profile.wallpaperKind === "color") {
      // Non serve alcun dato esterno: una tinta o una sfumatura sono sempre
      // disponibili una volta scelte, a differenza di un'immagine o un video.
      return "color";
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

    if (mode === "color") {
      // Un colore o una sfumatura non ha bisogno di dati esterni: si compone
      // qui e basta, a differenza di immagine e video.
      const flat = profile.wallpaperColor1;
      const gradient = `linear-gradient(${profile.wallpaperAngle}deg, ${profile.wallpaperColor1}, ${profile.wallpaperColor2})`;
      chunks.push(`
        body.o_home_menu_background {
          background-image: ${profile.wallpaperGradient ? gradient : "none"} !important;
          background-color: ${profile.wallpaperGradient ? "transparent" : flat} !important;
          background-attachment: fixed !important;
        }
        body.o_home_menu_background .o_home_menu {
          background-image: none !important;
          background-color: transparent !important;
        }
      `);
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

    // Sfondo, bordo, effetto e misura del disegno nascono da un'unica
    // funzione: finiscono tutti nelle stesse proprieta' CSS, quindi generarli
    // separatamente li farebbe sovrascrivere a vicenda.
    chunks.push(globalThis.ostIconCss(profile));
    chunks.push(globalThis.ostLabelCss(profile.labelColor));

    if (profile.hideAppNames) {
      chunks.push(globalThis.ostNoLabelsCss());
    }

    if (settings.copyFieldNames) {
      chunks.push(globalThis.ostToastCss());
    }

    if (settings.shellUi) {
      chunks.push(`
        #${MENU_ITEM_ID} .lm-MenuBar-itemLabel {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #c9761e;
        }
        #${MENU_ITEM_ID}:hover { background: rgba(255, 255, 255, 0.08); }
      `);
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
        applyIconArtwork();
        applyEditorMenu();
        scanForContextMenus();
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
    if (message && message.type === "ost:editor-status") {
      sendResponse({
        found: editorPresent(),
        terminalActive: !!visibleTerminal(),
        tabLabel: activeTabLabel(),
      });
      return false;
    }

    if (message && message.type === "ost:editor-run") {
      if (!settings.enabled) {
        sendResponse({ ok: false, error: "extension is off" });
        return false;
      }
      runInTerminal(message.command, message.newTerminal).then(sendResponse);
      // Risposta asincrona: il canale va tenuto aperto.
      return true;
    }

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

  /**
   * Passa il disegno dell'icona a una variabile CSS, cosi' il foglio di stile
   * puo' usarlo come livello di sfondo. Si scrive solo una proprieta'
   * personalizzata e una classe: nessuna modifica alla struttura del DOM ne'
   * all'attributo `src`, che restano di Odoo.
   */
  function applyIconArtwork() {
    const wanted = settings.enabled && profile.iconSize !== "l";

    for (const icon of document.querySelectorAll(".o_apps .o_app_icon")) {
      const marked = icon.classList.contains("ost-art");

      if (!wanted) {
        if (marked) {
          icon.classList.remove("ost-art");
          icon.style.removeProperty("--ost-art");
          // Va cancellato anche il promemoria della sorgente: senza, al
          // rientro in una misura ridotta il controllo qui sotto crederebbe
          // che l'icona sia gia' a posto e non rimetterebbe mai la classe.
          delete icon.dataset.ostArt;
        }
        continue;
      }
      const src = icon.currentSrc || icon.src;
      // Si salta solo se la sorgente e' la stessa E il segno e' ancora
      // applicato: sono due condizioni distinte e vanno verificate entrambe.
      if (!src || (marked && icon.dataset.ostArt === src)) {
        continue;
      }
      icon.dataset.ostArt = src;
      icon.style.setProperty("--ost-art", `url("${src}")`);
      icon.classList.add("ost-art");
    }
  }

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
    const node = event.target.nodeType === 3 ? event.target.parentElement : event.target;
    const label = node && node.closest ? node.closest("label") : null;

    if (label) {
      // Cliccare l'etichetta di una casella la commuta: con la copia attiva
      // quel comportamento va tolto, altrimenti si cambia un valore mentre si
      // voleva solo leggere il nome del campo. Vale solo per le `<label>`: le
      // intestazioni di elenco continuano a ordinare la colonna.
      event.preventDefault();

      const control =
        label.control || (label.htmlFor ? document.getElementById(label.htmlFor) : null);
      const isToggle =
        control && /^(checkbox|radio)$/i.test(control.type || "");
      if (isToggle || label.querySelector('input[type="checkbox"], input[type="radio"]')) {
        // Alcuni widget commutano da un gestore proprio, che `preventDefault`
        // non ferma: si blocca anche la risalita dell'evento.
        event.stopPropagation();
      }
    }

    copyText(name);
    showToast("Copied");
  }

  // ------------------------------------------------------------------
  // 5c. Editor di Odoo.sh
  // ------------------------------------------------------------------

  const BRIDGE_ID = "ost-editor-bridge";
  const CHANNEL_IN = "ost-editor-request";
  const CHANNEL_OUT = "ost-editor-response";
  const BRIDGE_TIMEOUT = 2000;

  let bridgeSeq = 0;
  const bridgeWaiting = new Map();

  /**
   * L'editor si riconosce dal guscio di JupyterLab, non dall'indirizzo: il
   * percorso cambia da progetto a progetto, mentre questi contenitori sono
   * sempre gli stessi.
   */
  function editorPresent() {
    // Il markup di JupyterLab e' il segnale primario; il percorso serve da
    // ripiego nella finestra in cui la pagina ha gia' l'indirizzo giusto ma
    // l'applicazione non ha ancora finito di montare i suoi contenitori.
    if (document.querySelector("#jp-main-dock-panel, .jp-LabShell, #jupyterlab-splash, [data-jp-theme-name]")) {
      return true;
    }
    return /\/odoo-sh\/editor(\/|$)/i.test(window.location.pathname);
  }

  /**
   * Terminale in primo piano. Si guarda al widget visibile invece che
   * all'etichetta della scheda: il titolo si puo' rinominare, il layout no.
   */
  function visibleTerminal() {
    for (const node of document.querySelectorAll(".jp-Terminal")) {
      if (node.offsetParent !== null) {
        return node;
      }
    }
    return null;
  }

  /** Etichetta della scheda attiva nell'area principale, a scopo informativo. */
  function activeTabLabel() {
    const tab = document.querySelector(
      '.lm-TabBar-tab.lm-mod-current[aria-selected="true"] .lm-TabBar-tabLabel'
    );
    return tab ? tab.textContent.trim() : "";
  }

  const MENU_ITEM_ID = "ost-shell-item";

  /**
   * Aggiunge "odoo-bin shell" in fondo alla barra dei menu di JupyterLab,
   * subito dopo Help. La voce viene rimessa dall'osservatore quando Lumino
   * ridisegna la barra, perche' quel nodo non e' gestito da noi.
   */
  function applyEditorMenu() {
    const wanted = settings.enabled && settings.shellUi && editorPresent();
    const existing = document.getElementById(MENU_ITEM_ID);

    if (!wanted) {
      if (existing) {
        existing.remove();
      }
      return;
    }
    if (existing) {
      return;
    }
    const bar = document.querySelector("#jp-MainMenu .lm-MenuBar-content");
    if (!bar) {
      return;
    }
    const item = document.createElement("li");
    item.id = MENU_ITEM_ID;
    item.className = "lm-MenuBar-item";
    item.setAttribute("role", "menuitem");
    item.title = "Open a terminal and run odoo-bin shell";

    const label = document.createElement("div");
    label.className = "lm-MenuBar-itemLabel";
    label.textContent = "odoo-bin shell";
    item.appendChild(label);

    // In cattura e con la propagazione fermata: la barra dei menu di Lumino
    // gestisce i propri click e aprirebbe un menu vuoto al posto nostro.
    item.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        runInTerminal("odoo-bin shell", true);
      },
      true
    );
    bar.appendChild(item);
  }

  function injectBridge() {
    if (document.getElementById(BRIDGE_ID)) {
      return;
    }
    const script = document.createElement("script");
    script.id = BRIDGE_ID;
    script.src = chrome.runtime.getURL("page/editor-bridge.js");
    // Il nodo NON va rimosso dopo il caricamento: e' l'unico segno che il
    // ponte c'e' gia'. Togliendolo, il controllo qui sopra non trovava piu'
    // nulla e il file veniva riscaricato ad ogni chiamata.
    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.channel !== CHANNEL_OUT) {
      return;
    }
    const pending = bridgeWaiting.get(data.id);
    if (pending) {
      bridgeWaiting.delete(data.id);
      clearTimeout(pending.timer);
      pending.resolve(data);
    }
  });

  /**
   * Inoltra un comando al ponte e attende l'esito. Il timeout evita che il
   * popup resti in attesa se lo script della pagina non risponde.
   */
  function runInTerminal(command, newTerminal) {
    return new Promise((resolve) => {
      injectBridge();
      const id = "cmd" + ++bridgeSeq;
      const timer = setTimeout(() => {
        bridgeWaiting.delete(id);
        resolve({ ok: false, error: "editor did not answer" });
      }, BRIDGE_TIMEOUT);

      bridgeWaiting.set(id, { resolve, timer });
      window.postMessage(
        { channel: CHANNEL_IN, id: id, command: command, newTerminal: !!newTerminal },
        window.location.origin
      );
    });
  }


  // ------------------------------------------------------------------
  // 5d. Copia/incolla nel terminale e comandi rapidi sui moduli
  // ------------------------------------------------------------------

  // Nome e tipo (file/cartella) dell'ultima voce su cui e' stato aperto il
  // menu contestuale: il menu stesso non porta questa informazione, va
  // catturata mentre si apre, sull'evento "contextmenu" originale.
  let lastContextEntry = null;

  document.addEventListener(
    "contextmenu",
    (event) => {
      const row = event.target.closest && event.target.closest(".jp-DirListing-item");
      lastContextEntry = row
        ? {
            name: (row.querySelector(".jp-DirListing-itemText span") || {}).textContent?.trim() || "",
            isDir: row.getAttribute("data-isdir") === "true",
          }
        : null;
      // Il menu del terminale resta quello nativo di Jupyter, pulsanti
      // disattivati compresi: e' quello che Odoo.sh mostra di suo, e
      // Maiusc+tasto destro apre gia' da solo (comportamento del browser,
      // non nostro) il menu nativo con Copy/Paste funzionanti quando c'e' una
      // selezione. Il problema di Ctrl+C si affronta altrove, vedi il
      // gestore "keydown" qui sotto.
    },
    true
  );

  /**
   * Copia reale con Ctrl+C dentro al terminale dell'editor, senza mandare
   * anche il segnale di interruzione.
   *
   * Per xterm.js, Ctrl+C e' sempre "manda SIGINT": il tasto viene intercettato
   * dal suo stesso gestore, che chiama preventDefault prima che il browser
   * possa fare la sua copia nativa — ed e' il motivo per cui compariva "^C"
   * anche con del testo selezionato. Qui si intercetta l'evento un livello
   * piu' sopra (un content script a document_start si aggancia ben prima che
   * Jupyter monti i propri gestori: stesso nodo, stessa fase, vince chi si e'
   * registrato prima) e si decide se e' il caso di copiare al posto di
   * interrompere.
   *
   * Entrambe le condizioni devono valere: si e' nell'editor di Odoo.sh E il
   * fuoco e' dentro a un terminale. Fuori da li' Ctrl+C deve continuare a
   * fare cio' che ha sempre fatto (copiare in un editor di testo, un
   * accorciatoia altrove, eccetera).
   */
  document.addEventListener(
    "keydown",
    (event) => {
      if (!settings.enabled || !settings.shellUi) {
        return;
      }
      if (event.key !== "c" && event.key !== "C") {
        return;
      }
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
      }
      if (!editorPresent()) {
        return;
      }
      const inTerminal = event.target.closest && event.target.closest(".jp-Terminal, .xterm");
      if (!inTerminal) {
        return;
      }
      const selection = window.getSelection();
      // Senza nulla di selezionato Ctrl+C deve restare cio' che e' sempre
      // stato in un terminale: l'interruzione del comando in corso.
      if (!selection || selection.isCollapsed || !selection.toString()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try {
        document.execCommand("copy");
      } catch (err) {
        // Nessun modo alternativo affidabile da qui: si rinuncia in silenzio
        // piuttosto che lasciare comunque partire il segnale di interruzione.
      }
    },
    true
  );

  /** Un pulsante di comando rapido, con lo stesso aspetto delle voci di Lumino. */
  function buildQuickCommandItem(label, command) {
    const li = document.createElement("li");
    li.className = "lm-Menu-item";
    li.setAttribute("role", "menuitem");
    li.tabIndex = 0;
    li.style.pointerEvents = "auto";
    li.style.cursor = "pointer";
    li.dataset.ostQuickCommand = "1";
    li.innerHTML =
      '<div class="lm-Menu-itemIcon"></div>' +
      `<div class="lm-Menu-itemLabel">${label}</div>` +
      '<div class="lm-Menu-itemShortcut"></div>' +
      '<div class="lm-Menu-itemSubmenuIcon"></div>';

    // Colore al passaggio del mouse gestito a mano: la classe con cui Lumino
    // evidenzia le proprie voci dipende da un elenco interno che non ci
    // riguarda, quindi senza questo la voce resterebbe visivamente morta.
    li.addEventListener("mouseenter", () => {
      li.style.background = "rgba(255, 255, 255, 0.08)";
    });
    li.addEventListener("mouseleave", () => {
      li.style.background = "";
    });

    const run = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      runInTerminal(command, true);
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
      );
    };
    li.addEventListener("pointerdown", run, true);
    li.addEventListener("mousedown", run, true);
    li.addEventListener("click", run, true);
    return li;
  }

  /**
   * Aggiunge "Zip folder" e "Update module" in fondo al menu del file
   * browser, solo quando la voce cliccata col destro e' una cartella.
   *
   * La cartella su cui agire si ricava ogni volta da `lastContextEntry`
   * corrente, mai fissata alla prima apertura: Lumino tiene sotto certe
   * condizioni un solo elemento di menu vivo e lo riposiziona invece di
   * ricrearlo da zero ad ogni click destro, quindi affidarsi a un flag "gia'
   * fatto una volta per sempre" lasciava le voci vecchie, con la cartella
   * sbagliata incorporata nel comando, ogni volta che si cambiava bersaglio —
   * ed e' esattamente il comportamento segnalato.
   */
  function addQuickCommands(menu) {
    const list = menu.querySelector(".lm-Menu-content");
    if (!list) {
      return;
    }
    const wantedName = lastContextEntry && lastContextEntry.isDir ? lastContextEntry.name : "";

    // Il confronto e' con la cartella per cui il menu e' stato aggiornato
    // l'ultima volta, non con un semplice "fatto/non fatto": cosi' si
    // ricostruisce solo quando il bersaglio e' davvero cambiato, invece che
    // ad ogni mutazione del DOM mentre il menu resta semplicemente aperto.
    if (list.dataset.ostQuickFor === wantedName) {
      return;
    }
    for (const old of list.querySelectorAll('[data-ost-quick-command="1"]')) {
      old.remove();
    }
    list.dataset.ostQuickFor = wantedName;
    if (!wantedName) {
      return;
    }
    list.appendChild(buildQuickCommandItem("Zip folder", `zip -r ${wantedName}.zip ${wantedName}`));
    list.appendChild(buildQuickCommandItem("Update module", `odoo-bin -u ${wantedName} --st`));
  }

  /**
   * Un menu di Lumino e' anonimo finche' non se ne guarda il contenuto: lo si
   * riconosce dai comandi che contiene, non dalla classe (che e' la stessa
   * per ogni menu contestuale dell'applicazione). Il solo menu che qui
   * interessa e' quello del file browser: quello del terminale non arriva
   * nemmeno ad aprirsi, vedi il gestore "contextmenu" qui sopra.
   */
  function augmentEditorMenu(node) {
    if (node.querySelector('[data-command^="filebrowser:"]')) {
      addQuickCommands(node);
    }
  }

  /**
   * Scandaglia l'intero documento invece di fidarsi di quale nodo esatto sia
   * comparso in una mutazione: Lumino a volte monta il menu dentro a un
   * contenitore intermedio creato nello stesso istante, quindi il nodo
   * aggiunto di primo livello non e' detto porti la classe "lm-Menu" lui
   * stesso. Questi menu sono rarissimi (`.lm-Menu` e' quasi sempre assente),
   * quindi il costo di cercarli ovunque e' trascurabile.
   */
  function scanForContextMenus() {
    if (!settings.enabled || !settings.shellUi) {
      return;
    }
    for (const menu of document.querySelectorAll(".lm-Menu")) {
      augmentEditorMenu(menu);
    }
  }

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // Orchestrazione
  // ------------------------------------------------------------------

  /**
   * Rimuove ogni traccia dell'estensione dalla pagina. Serve allo spegnimento
   * dell'interruttore generale: alcune cose (foglio di stile, livello video,
   * targhetta) sono nostre e le togliamo noi, ma cio' che Odoo aveva calcolato
   * a partire dai nostri stili non torna indietro da solo. Per questo si
   * ricarica subito la pagina, cosi' il sito ripristina i propri fogli di
   * stile senza che l'utente debba farlo a mano.
   */
  function teardownEverything() {
    let hadSomething = false;

    const style = document.getElementById(STYLE_ID);
    if (style) {
      style.remove();
      hadSomething = true;
    }
    if (document.getElementById(LAYER_ID)) {
      removeVideoLayer();
      hadSomething = true;
    }
    const badge = document.getElementById("ost-env-badge");
    if (badge) {
      badge.remove();
      hadSomething = true;
    }
    const toast = document.getElementById("ost-copy-toast");
    if (toast) {
      toast.remove();
    }
    if (document.body) {
      document.body.classList.remove(VIDEO_ON_CLASS);
      for (const icon of document.querySelectorAll(".o_app_icon.ost-art")) {
        icon.classList.remove("ost-art");
        icon.style.removeProperty("--ost-art");
        delete icon.dataset.ostArt;
        hadSomething = true;
      }
    }
    currentEnv = "";
    restoreHiddenBanners();
    stopObservers();

    return hadSomething;
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
  }

  function applyAll() {
    applyBadge();
    applyCss();
    applyIconArtwork();
    applyMediaLayer();
    if (settings.enabled && settings.shellUi && editorPresent()) {
      injectBridge();
    }
    applyEditorMenu();
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
    const wasEnabled = settings.enabled;
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

        // Spegnimento generale: si smonta tutto e si ricarica, cosi' la
        // pagina torna esattamente com'era senza residui dei nostri stili.
        if (wasEnabled && !settings.enabled) {
          const hadSomething = teardownEverything();
          if (hadSomething) {
            window.location.reload();
          }
          return;
        }

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
