/**
 * Popup dell'estensione.
 *
 * Tre record separati in storage: impostazioni leggere, sfondo attivo e
 * libreria. Gli slider riscrivono solo il primo, cosi' trascinare un cursore
 * non ricopia in storage un video da decine di MB ne' l'intera cronologia.
 */
(function () {
  "use strict";

  const KEY = globalThis.OST_KEY_SETTINGS;
  const LIB_KEY = globalThis.OST_KEY_LIBRARY;

  // Oltre questa larghezza l'immagine viene ricampionata: un data URL enorme
  // rallenterebbe ogni caricamento di pagina.
  const MAX_IMAGE_WIDTH = 2560;
  const THUMB_SIZE = 400;
  const JPEG_QUALITY = 0.85;
  const SAVE_DELAY = 150;

  const el = (id) => document.getElementById(id);
  // Interruttori validi su ogni progetto.
  let settings = globalThis.ostNormalizeGlobal(null);
  // Aspetto del dominio attualmente aperto.
  let profile = globalThis.ostNormalizeProfile(null);
  let media = globalThis.ostNormalizeMedia(null);
  let library = [];
  let savedTimer = null;
  let writeTimer = null;
  let profileTimer = null;

  // Dominio della scheda attiva e chiave su cui scrivere l'aspetto. Fuori da
  // Odoo si modifica il profilo di riferimento, non si sporca lo storage con
  // un record per ogni sito visitato.
  let host = "";
  let activeTabId = null;
  let activeTabOrigin = "";
  let profileHost = globalThis.OST_DEFAULT_HOST;
  let environment = "";
  let customHosts = [];


  // Una sola cartella collegata alla volta, come richiesto: collegarne
  // un'altra sostituisce la precedente. Le sue immagini non vengono copiate
  // in libreria ma lette dal vivo ad ogni apertura, cosi' una foto cancellata
  // dal disco sparisce anche dalla galleria invece di restare come voce morta.
  //
  // La maniglia non e' persistita: la File System Access API richiede
  // comunque un gesto dell'utente per riconcedere il permesso, quindi
  // conservarla costringerebbe a un secondo click di conferma.
  let folderHandle = null;
  // Maniglia recuperata da IndexedDB il cui permesso va riconfermato con un
  // gesto dell'utente: si mostra il nome con un pulsante di riconnessione.
  let folderPending = null;
  let folderName = "";
  let folderEntries = [];

  const profileKey = () => globalThis.ostProfileKey(profileHost);
  const mediaKey = () => globalThis.ostMediaKey(profileHost);

  // ------------------------------------------------------------------
  // Persistenza
  // ------------------------------------------------------------------

  function flash() {
    const badge = el("saved");
    badge.classList.add("on");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => badge.classList.remove("on"), 900);
  }

  /** Interruttori globali, accorpati per non spammare lo storage. */
  function saveSettings() {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      chrome.storage.local.set({ [KEY]: settings }, flash);
    }, SAVE_DELAY);
  }

  /** Aspetto: finisce nel record del dominio aperto, non in quello globale. */
  function saveProfile() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      chrome.storage.local.set({ [profileKey()]: profile }, flash);
    }, SAVE_DELAY);
  }

  function saveMedia() {
    chrome.storage.local.set({ [mediaKey()]: media }, flash);
  }

  function saveLibrary() {
    chrome.storage.local.set({ [LIB_KEY]: library });
  }

  /** Modifica un interruttore globale. */
  function update(patch) {
    Object.assign(settings, patch);
    render();
    saveSettings();
  }

  /** Modifica l'aspetto del dominio corrente. */
  function updateProfile(patch) {
    Object.assign(profile, patch);
    render();
    saveProfile();
  }

  // ------------------------------------------------------------------
  // Libreria sfondi
  // ------------------------------------------------------------------

  function newId() {
    return "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Voce corrispondente allo sfondo attualmente applicato, se presente. */
  function activeEntry() {
    if (profile.wallpaperKind !== "image") {
      return null;
    }
    if (profile.imageSource === "url") {
      return { source: "url", url: profile.imageUrl, name: profile.imageUrl };
    }
    // Per caricamenti e cartelle il confronto e' sul nome del file: e' l'unico
    // dato che sopravvive sia al salvataggio in libreria sia alla rilettura
    // della cartella, dove i dati veri non vengono conservati.
    if (!profile.imageName) {
      return null;
    }
    return { source: profile.imageSource, url: "", name: profile.imageName };
  }

  /**
   * Aggiunge una voce evitando i doppioni: i link si confrontano per URL, i
   * file e le voci da cartella per nome e peso, che bastano a riconoscere lo
   * stesso file scelto due volte senza confrontare stringhe da megabyte.
   */
  function addToLibrary(entry) {
    const twin = library.find((e) =>
      entry.source === "url"
        ? e.source === "url" && e.url === entry.url
        : (e.source === "file" || e.source === "folder") && e.name === entry.name && e.size === entry.size
    );
    if (twin) {
      twin.usedAt = Date.now();
      saveLibrary();
      return twin;
    }
    entry.usedAt = Date.now();
    library.push(entry);

    if (library.length > globalThis.OST_LIBRARY_LIMIT) {
      // Si scarta la voce usata meno di recente, mai quella attiva.
      const active = activeEntry();
      const victim = library
        .filter((e) => e !== active)
        .sort((a, b) => a.usedAt - b.usedAt)[0];
      library = library.filter((e) => e !== victim);
    }
    saveLibrary();
    return entry;
  }

  function applyEntry(entry) {
    entry.usedAt = Date.now();
    saveLibrary();

    if (entry.source === "url") {
      updateProfile({
        imageSource: "url",
        imageUrl: entry.url,
        imageName: "",
        wallpaperKind: "image",
        wallpaperEnabled: true,
      });
    } else {
      media.imageData = entry.data;
      saveMedia();
      // La sorgente si preserva com'era (file oppure folder): serve solo a
      // scegliere l'icona nella libreria, il content script le tratta uguali.
      updateProfile({
        imageSource: entry.source,
        imageName: entry.name,
        wallpaperKind: "image",
        wallpaperEnabled: true,
      });
    }
  }

  /**
   * Le voci da cartella locale non si possono "eliminare" nel senso proprio:
   * il file originale resta sul disco dell'utente, qui si toglie solo dalla
   * cronologia. Per questo, e perche' l'utente l'ha chiesto esplicitamente,
   * il cestino non compare affatto per queste voci (vedi renderLibrary).
   */
  function removeEntry(entry) {
    library = library.filter((e) => e !== entry);
    saveLibrary();
    render();
  }

  function recentEntries() {
    return library
      .slice()
      .sort((a, b) => b.usedAt - a.usedAt)
      .slice(0, globalThis.OST_RECENT_COUNT);
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  function selectGroup(selector, attr, value) {
    for (const btn of document.querySelectorAll(selector)) {
      const on = btn.dataset[attr] === value;
      const key = btn.getAttribute("role") === "radio" ? "aria-checked" : "aria-selected";
      btn.setAttribute(key, String(on));
    }
  }

  const TRASH_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2"/></svg>';

  // Un'icona per provenienza, mostrata in permanenza (non solo al passaggio
  // del mouse come il cestino) cosi' si distingue a colpo d'occhio se
  // un'immagine e' un link, un caricamento o una scelta da cartella locale.
  const ORIGIN_SVG = {
    url: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5a2.5 2.5 0 0 0 3.5.2l1.8-1.8a2.5 2.5 0 0 0-3.5-3.5L7.2 5.5"/><path d="M9.5 6.5a2.5 2.5 0 0 0-3.5-.2l-1.8 1.8a2.5 2.5 0 0 0 3.5 3.5l1.1-1.1"/></svg>',
    file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11.5V3.5M4.5 7 8 3.5 11.5 7"/><path d="M3.5 12.5h9"/></svg>',
    folder: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h3.8l1.2 1.5h6v6.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-8z"/></svg>',
  };
  const ORIGIN_LABEL = { url: "Added by link", file: "Uploaded", folder: "From a local folder" };

  /**
   * Voci mostrate in galleria e in libreria: la cronologia salvata piu' le
   * immagini della cartella collegata. Quelle della cartella sono lette dal
   * vivo e non salvate, quindi una foto cancellata dal disco sparisce da sola
   * invece di restare come voce morta.
   */
  function allEntries() {
    return library.concat(folderEntries.filter((e) => e.kind === "image").map(folderAsEntry));
  }

  /** Adatta una voce di cartella alla forma usata da galleria e libreria. */
  function folderAsEntry(fe) {
    return {
      id: "folder:" + fe.name,
      source: "folder",
      url: "",
      data: "",
      thumb: fe.thumbUrl,
      name: fe.name,
      size: 0,
      usedAt: fe.usedAt || 0,
      handle: fe.handle,
    };
  }

  const PLUS_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>';
  const MORE_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>';

  /**
   * Quattro sfondi recenti piu' il collegamento alla libreria. I posti ancora
   * liberi restano visibili come segnaposto con il piu': la griglia non
   * cambia forma man mano che si aggiungono sfondi, e c'e' sempre un punto
   * ovvio dove cliccare per caricarne uno.
   */
  function renderGallery() {
    const box = el("recent");
    box.textContent = "";

    const active = activeEntry();
    const recents = allEntries()
      .slice()
      .sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0))
      .slice(0, 4);

    for (let i = 0; i < 4; i += 1) {
      const entry = recents[i];
      if (entry) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "gal-item";
        item.style.backgroundImage = `url("${entry.thumb}")`;
        item.title = entry.name || entry.url;
        item.setAttribute("aria-label", `Use ${entry.name || entry.url}`);
        item.setAttribute("aria-current", String(isSameEntry(entry, active)));
        item.addEventListener("click", () => pickEntry(entry));

        const origin = document.createElement("span");
        origin.className = "gal-origin";
        origin.innerHTML = ORIGIN_SVG[entry.source] || ORIGIN_SVG.file;
        item.appendChild(origin);
        box.appendChild(item);
      } else {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "gal-item gal-slot";
        slot.innerHTML = PLUS_SVG;
        slot.title = "Add a wallpaper";
        slot.setAttribute("aria-label", "Add a wallpaper");
        slot.addEventListener("click", () => el("wallpaperInput").click());
        box.appendChild(slot);
      }
    }

    const more = document.createElement("button");
    more.type = "button";
    more.className = "gal-item gal-more";
    more.innerHTML = MORE_SVG + "<span>All</span>";
    more.title = "See all wallpapers";
    more.addEventListener("click", () => showScreen("library"));
    box.appendChild(more);
  }

  /** Due voci coincidono se hanno la stessa provenienza e lo stesso contenuto. */
  function isSameEntry(a, b) {
    if (!a || !b) {
      return false;
    }
    if (a.source === "url" || b.source === "url") {
      return a.source === b.source && a.url === b.url;
    }
    return a.source === b.source && a.name === b.name;
  }

  /** Applica una voce, leggendo il file dalla cartella se serve. */
  function pickEntry(entry) {
    if (entry.source === "folder" && entry.handle) {
      applyFolderImage(entry.handle);
      return;
    }
    applyEntry(entry);
  }

  /**
   * Tre stati possibili: nessuna cartella, cartella nota ma da riconnettere
   * (il permesso e' scaduto e serve un click), cartella collegata.
   */
  function renderFolderBar() {
    const known = !!(folderHandle || folderPending);
    el("folderChip").hidden = !known;
    el("pickFolder").hidden = known;
    el("folderName").textContent = folderName;
    el("reconnectFolder").hidden = !folderPending;
    if (folderPending) {
      el("folderNote").textContent = "Folder remembered — reconnect it to read the files again.";
    }
  }

  function unlinkFolder() {
    // Le anteprime erano object URL: senza revoca resterebbero in memoria
    // per tutta la vita del popup.
    for (const entry of folderEntries) {
      if (entry.thumbUrl) {
        URL.revokeObjectURL(entry.thumbUrl);
      }
    }
    folderHandle = null;
    folderPending = null;
    folderName = "";
    folderEntries = [];
    idbDelete(FOLDER_KEY);
    el("folderNote").textContent = "";
    render();
  }

  function renderLibrary() {
    const grid = el("libGrid");
    grid.textContent = "";
    const total = allEntries().length;
    el("libEmpty").hidden = total > 0;
    el("libCount").textContent = total ? `${total} saved` : "";

    const active = activeEntry();
    const entries = allEntries().slice().sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0));

    for (const entry of entries) {
      const item = document.createElement("div");
      item.className = "lib-item";
      item.style.backgroundImage = `url("${entry.thumb}")`;
      item.setAttribute("aria-current", String(isSameEntry(entry, active)));

      const pick = document.createElement("button");
      pick.type = "button";
      pick.style.cssText =
        "position:absolute;inset:0;border:0;background:none;cursor:pointer";
      pick.setAttribute("aria-label", `Use ${entry.name || entry.url}`);
      pick.title = entry.name || entry.url;
      pick.addEventListener("click", () => {
        pickEntry(entry);
        showScreen("appearance");
      });

      const origin = document.createElement("span");
      origin.className = "lib-origin";
      origin.innerHTML = ORIGIN_SVG[entry.source] || ORIGIN_SVG.file;
      origin.title = ORIGIN_LABEL[entry.source] || "";

      item.appendChild(pick);
      item.appendChild(origin);

      // Una voce da cartella locale non ha nulla da "eliminare": il file
      // resta sul disco dell'utente. Il cestino qui sparisce del tutto,
      // com'e' stato chiesto esplicitamente, invece di restare presente ma
      // inutile.
      if (entry.source !== "folder") {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "lib-del";
        del.innerHTML = TRASH_SVG;
        del.setAttribute("aria-label", "Remove from library");
        del.title = "Remove from library";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          removeEntry(entry);
        });
        item.appendChild(del);
      }

      grid.appendChild(item);
    }
  }

  function render() {
    document.body.classList.toggle("off", !settings.enabled);
    el("enabled").checked = settings.enabled;
    el("hideTrialBanner").checked = settings.hideTrialBanner;
    el("hideNeutralizeBanner").checked = settings.hideNeutralizeBanner;
    el("debugMode").checked = settings.debugMode;
    el("copyFieldNames").checked = settings.copyFieldNames;
    el("shellUi").checked = settings.shellUi;

    renderBadgeControls();

    el("iconBackground").value = profile.iconBackground;
    el("iconBorder").value = profile.iconBorder;
    el("iconEffect").value = profile.iconEffect;
    selectGroup(".seg-btn[data-label]", "label", profile.labelColor);
    el("hideAppNames").checked = profile.hideAppNames;
    el("scopeNote").textContent =
      profileHost === globalThis.OST_DEFAULT_HOST
        ? "Appearance applies to every new project"
        : `Appearance saved for ${profileHost}`;

    el("wallpaperEnabled").checked = profile.wallpaperEnabled;
    el("wallpaperPanel").hidden = !profile.wallpaperEnabled;

    // Il campo del link non conserva l'indirizzo gia' applicato: una volta
    // aggiunto lo sfondo il campo torna vuoto, pronto per il prossimo.
    renderFolderBar();

    const dim = Math.round(profile.wallpaperDim * 100);
    el("wallpaperDim").value = dim;
    el("dimOut").textContent = dim + "%";
    el("wallpaperBlur").value = profile.wallpaperBlur;
    el("blurOut").textContent = profile.wallpaperBlur + "px";

    el("roundIconsEnabled").checked = profile.roundIconsEnabled;
    el("iconRadius").value = profile.iconRadius;
    el("iconRadius").disabled = !profile.roundIconsEnabled;
    el("radiusOut").textContent = profile.roundIconsEnabled ? profile.iconRadius + "px" : "off";
    selectGroup(".seg-btn[data-iconsize]", "iconsize", profile.iconSize);
    renderIconPreview();

    renderGallery();
    if (!el("screenLibrary").hidden) {
      renderLibrary();
    }
  }


  // ------------------------------------------------------------------
  // Costruttore icone
  // ------------------------------------------------------------------

  /**
   * I menu nascono dagli stessi elenchi che generano il CSS: aggiungere uno
   * sfondo o un bordo in themes.js lo fa comparire qui senza toccare il popup.
   */
  function buildIconSelects() {
    const groups = [
      ["iconBackground", globalThis.OST_ICON_BACKGROUNDS],
      ["iconBorder", globalThis.OST_ICON_BORDERS],
      ["iconEffect", globalThis.OST_ICON_EFFECTS],
    ];
    for (const [id, table] of groups) {
      const sel = el(id);
      sel.textContent = "";
      for (const [key, def] of Object.entries(table)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = def.label || key;
        sel.appendChild(opt);
      }
    }
  }

  /**
   * Anteprima dal vivo: si riusa esattamente il CSS che finira' nella pagina,
   * limitato al riquadro di anteprima. Cosi' non esiste una seconda
   * implementazione dell'aspetto che possa divergere da quella vera.
   */
  function renderIconPreview() {
    let sheet = document.getElementById("ost-preview-style");
    if (!sheet) {
      sheet = document.createElement("style");
      sheet.id = "ost-preview-style";
      document.head.appendChild(sheet);
    }
    const css = globalThis
      .ostIconCss(Object.assign({}, profile, { iconSize: "l" }))
      // Il CSS reale e' ancorato al drawer di Odoo: qui va riportato sul
      // riquadro di anteprima, che ha una struttura equivalente.
      .replace(/body\.o_home_menu_background \.o_apps \.o_app\.o_menuitem/g, ".builder-preview")
      .replace(/body\.o_home_menu_background \.o_apps \.o_app_icon/g, "#iconPreview")
      .replace(/\.o_app_icon/g, "#iconPreview");

    sheet.textContent = css;
    el("iconPreview").style.borderRadius =
      (profile.roundIconsEnabled ? profile.iconRadius : 0) + "px";
    el("iconPreviewCaption").hidden = profile.hideAppNames;
  }

  // ------------------------------------------------------------------
  // Targhetta ambiente
  // ------------------------------------------------------------------

  /** La palette nasce dall'elenco condiviso, non da campioni scritti a mano. */
  function buildPalette() {
    const box = el("palette");
    const custom = box.querySelector(".sw-custom");
    for (const color of globalThis.OST_PALETTE) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sw";
      btn.setAttribute("role", "radio");
      btn.dataset.color = color;
      btn.style.background = color;
      btn.title = color;
      btn.setAttribute("aria-label", `Badge colour ${color}`);
      box.insertBefore(btn, custom);
    }
  }

  function renderBadgeControls() {
    el("badgeEnabled").checked = settings.badgeEnabled;
    el("badgePanel").hidden = !settings.badgeEnabled;

    selectGroup(".corner", "corner", settings.badgeCorner);
    el("badgeSize").value = settings.badgeSize;
    el("badgeSizeOut").textContent = settings.badgeSize + "px";

    for (const sw of document.querySelectorAll(".sw[data-color]")) {
      sw.setAttribute("aria-checked", String(sw.dataset.color === settings.badgeColor));
    }
    const isPreset =
      settings.badgeColor === "auto" || globalThis.OST_PALETTE.includes(settings.badgeColor);
    const customSwatch = document.querySelector(".sw-custom");
    customSwatch.setAttribute("aria-checked", String(!isPreset));
    if (!isPreset) {
      el("badgeCustom").value = settings.badgeColor;
    }

    // L'esclusione vale solo sui sottodomini Odoo: senza questo limite ci si
    // ritroverebbe una lista di siti qualunque nelle eccezioni.
    const canExclude =
      globalThis.ostIsOdooHost(host) && host.split(".").length > 2;
    el("badgeHidden").disabled = !canExclude;
    el("badgeHidden").checked = canExclude && profile.badgeHidden;
    el("badgeHiddenHint").textContent = canExclude
      ? `Never show it on ${host}`
      : "Available on Odoo project domains only.";

    const env = environment || "PROD";
    const preview = el("badgePreview");
    const color =
      settings.badgeColor === "auto"
        ? globalThis.OST_ENV_COLORS[env] || "#4a4f5e"
        : settings.badgeColor;
    preview.textContent = env;
    preview.style.background = color;
    preview.style.color = globalThis.ostContrastInk(color);
    preview.style.fontSize = settings.badgeSize + "px";
  }

  function showScreen(name) {
    // La sezione scelta viene ricordata, cosi' riaprendo il popup si torna
    // dove si era rimasti. La libreria non conta: e' un approfondimento
    // dell'aspetto, non una sezione a se'.
    if (globalThis.OST_SCREENS.includes(name) && settings.lastScreen !== name) {
      settings.lastScreen = name;
      saveSettings();
    }
    el("screenAppearance").hidden = name !== "appearance";
    el("screenDeveloper").hidden = name !== "developer";
    el("screenLibrary").hidden = name !== "library";
    el("screenEditor").hidden = name !== "editor";
    // La libreria e' un approfondimento dell'aspetto: la scheda in alto resta
    // "Appearance", altrimenti sembrerebbe di aver cambiato sezione.
    const tab = name === "library" ? "appearance" : name;
    for (const btn of document.querySelectorAll(".tab")) {
      btn.setAttribute("aria-selected", String(btn.dataset.screen === tab));
    }
    // Azzerare tutto da una schermata che non mostra quelle impostazioni
    // sarebbe poco chiaro: il piede resta legato alle impostazioni.
    el("foot").hidden = name === "editor";

    if (name === "library") {
      renderLibrary();
      el("libBack").focus();
    }
    if (name === "editor") {
      refreshEditor();
    }
  }

  // ------------------------------------------------------------------
  // Editor di Odoo.sh
  // ------------------------------------------------------------------

  /** Interroga la scheda attiva; l'assenza di risposta vale come "non trovato". */
  function askEditor(message) {
    return new Promise((resolve) => {
      if (activeTabId === null) {
        resolve(null);
        return;
      }
      chrome.tabs.sendMessage(activeTabId, message, (response) => {
        resolve(chrome.runtime.lastError ? null : response || null);
      });
    });
  }

  async function refreshEditor() {
    const status = await askEditor({ type: "ost:editor-status" });
    const found = !!(status && status.found);

    el("editorEmpty").hidden = found;
    el("editorBody").hidden = !found;
    el("editorResult").textContent = "";
    if (!found) {
      return;
    }

    const ready = !!status.terminalActive;
    const state = el("editorState");
    state.classList.toggle("ready", ready);
    state.textContent = ready
      ? `Editor connected — terminal open${status.tabLabel ? ` — ${status.tabLabel}` : ""}`
      : "Editor connected — no terminal open yet";

  }

  /** Stima leggibile del peso di un data URL (base64: ~3/4 di byte reali). */
  function describeSize(dataUrl) {
    const bytes = Math.round((dataUrl.length * 3) / 4);
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  // ------------------------------------------------------------------
  // Immagini
  // ------------------------------------------------------------------

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = src;
    });
  }

  /** Ricampiona solo se serve: un PNG piccolo resta intatto e senza perdite. */
  async function normalizeImage(dataUrl) {
    const img = await loadImage(dataUrl);
    if (img.naturalWidth <= MAX_IMAGE_WIDTH && dataUrl.length < 1.5 * 1024 * 1024) {
      return dataUrl;
    }
    const scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }

  /**
   * Miniatura quadrata ritagliata al centro. Serve alla griglia: decodificare
   * ventiquattro immagini a piena risoluzione per mostrarle a 150 px sarebbe
   * uno spreco di memoria evidente all'apertura del popup.
   */
  async function makeThumb(dataUrl) {
    const img = await loadImage(dataUrl);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  async function handleImageFile(file) {
    const note = el("folderNote");
    note.textContent = "Processing image…";
    try {
      const optimized = await normalizeImage(await readAsDataUrl(file));
      const thumb = await makeThumb(optimized);
      applyEntry(
        addToLibrary({
          id: newId(),
          source: "file",
          url: "",
          data: optimized,
          thumb: thumb,
          name: file.name,
          size: file.size,
        })
      );
      note.textContent = "";
    } catch (err) {
      note.textContent = "That file couldn't be read. Try a PNG, JPG, WebP or GIF.";
    }
  }

  function handleImageUrl(url) {
    if (!url) {
      return;
    }
    let host = url;
    try {
      host = new URL(url).hostname;
    } catch (err) {
      el("folderNote").textContent = "That doesn't look like a valid link.";
      return;
    }
    applyEntry(
      addToLibrary({
        id: newId(),
        source: "url",
        url: url,
        data: "",
        thumb: url,
        name: host,
        size: 0,
      })
    );
    // Campo svuotato: l'indirizzo e' ormai in galleria, tenerlo scritto
    // suggerirebbe che vada riconfermato.
    el("imageUrl").value = "";
  }

  async function handleVideoFile(file) {
    const note = el("folderNote");
    if (file.size > globalThis.OST_MAX_VIDEO_BYTES) {
      const limit = Math.round(globalThis.OST_MAX_VIDEO_BYTES / (1024 * 1024));
      note.textContent = `That video is ${(file.size / (1024 * 1024)).toFixed(0)} MB. Keep uploads under ${limit} MB.`;
      return;
    }
    note.textContent = "Storing video…";
    try {
      media.videoData = await readAsDataUrl(file);
      media.videoName = file.name;
      saveMedia();
      updateProfile({ videoSource: "file", wallpaperKind: "video", wallpaperEnabled: true });
    } catch (err) {
      note.textContent = "That file couldn't be read. Try an MP4, WebM or Ogg file.";
    }
  }

  /**
   * Un solo pulsante di caricamento per foto e video: l'utente non deve
   * decidere in anticipo cosa sta per scegliere, il tipo si riconosce dal
   * file stesso una volta selezionato.
   */
  function handleWallpaperFile(file) {
    if (globalThis.ostAllowedImage(file)) {
      handleImageFile(file);
    } else if (globalThis.ostAllowedVideo(file)) {
      handleVideoFile(file);
    } else {
      el("folderNote").textContent =
        "Unsupported format. Use a photo (PNG/JPG/WebP/GIF) or a video (MP4/WebM/Ogg) — browsers can't play AVI.";
    }
  }

  // ------------------------------------------------------------------
  // Persistenza della cartella collegata
  // ------------------------------------------------------------------

  /*
   * La maniglia di una cartella e' clonabile strutturalmente, quindi si puo'
   * conservare in IndexedDB — ma non in chrome.storage, che serializza in JSON
   * e la ridurrebbe a un oggetto vuoto. E' l'unico motivo per cui qui c'e' un
   * database invece di una semplice chiave.
   *
   * La cartella e' volutamente GLOBALE, non per dominio: e' una raccolta di
   * immagini dell'utente, non una preferenza di un singolo progetto.
   */
  const IDB_NAME = "ost_handles";
  const IDB_STORE = "handles";
  const FOLDER_KEY = "wallpaperFolder";

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(key) {
    const db = await idbOpen();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  /**
   * Riprende la cartella salvata all'apertura del popup.
   *
   * Il permesso puo' essere ancora concesso oppure essere tornato in stato
   * "prompt": in quel caso il browser esige un gesto dell'utente e non si puo'
   * chiedere nulla di nascosto all'avvio. Si mostra allora il nome con un
   * pulsante di riconnessione, invece di far sparire in silenzio la cartella.
   */
  async function restoreFolder() {
    let saved = null;
    try {
      saved = await idbGet(FOLDER_KEY);
    } catch (err) {
      return;
    }
    if (!saved || !saved.handle) {
      return;
    }
    folderName = saved.name || saved.handle.name || "folder";

    let state = "prompt";
    try {
      state = await saved.handle.queryPermission({ mode: "read" });
    } catch (err) {
      state = "prompt";
    }
    if (state === "granted") {
      folderHandle = saved.handle;
      await readFolder();
    } else {
      // Maniglia nota ma non ancora autorizzata in questa sessione.
      folderPending = saved.handle;
    }
    render();
  }

  /** Riconnessione esplicita: qui siamo dentro a un click, il permesso si puo' chiedere. */
  async function reconnectFolder() {
    if (!folderPending) {
      return;
    }
    let state = "denied";
    try {
      state = await folderPending.requestPermission({ mode: "read" });
    } catch (err) {
      state = "denied";
    }
    if (state !== "granted") {
      el("folderNote").textContent = "Permission to read that folder wasn't granted.";
      return;
    }
    folderHandle = folderPending;
    folderPending = null;
    await readFolder();
    render();
  }

  // ------------------------------------------------------------------
  // Cartella locale
  // ------------------------------------------------------------------

  /**
   * Legge un file scelto dalla cartella e lo applica esattamente come un
   * caricamento manuale: la provenienza "folder" serve solo alla libreria
   * (icona, niente cestino), il content script non fa alcuna distinzione.
   */
  /**
   * Applica un'immagine della cartella. Non la si aggiunge alla libreria: e'
   * gia' visibile in galleria attraverso folderEntries, e salvarla creerebbe
   * un doppione permanente che sopravvivrebbe anche allo scollegamento della
   * cartella.
   */
  async function applyFolderImage(fileHandle) {
    const note = el("folderNote");
    const file = await fileHandle.getFile();
    const known = folderEntries.find((e) => e.handle === fileHandle);
    if (known) {
      known.usedAt = Date.now();
    }
    if (!globalThis.ostAllowedImage(file)) {
      note.textContent = `"${file.name}" has a format the browser can't show. Use PNG, JPG, WebP or GIF.`;
      return;
    }
    note.textContent = "Processing image…";
    try {
      const optimized = await normalizeImage(await readAsDataUrl(file));
      media.imageData = optimized;
      saveMedia();
      updateProfile({
        imageSource: "folder",
        imageName: file.name,
        wallpaperKind: "image",
        wallpaperEnabled: true,
      });
      note.textContent = folderName ? `Folder: ${folderName}` : "";
    } catch (err) {
      note.textContent = "That file couldn't be read.";
    }
  }

  async function applyFolderVideo(fileHandle) {
    const note = el("folderNote");
    const file = await fileHandle.getFile();
    if (!globalThis.ostAllowedVideo(file)) {
      note.textContent = `"${file.name}" has a format browsers can't play. Use MP4, WebM or Ogg.`;
      return;
    }
    if (file.size > globalThis.OST_MAX_VIDEO_BYTES) {
      const limit = Math.round(globalThis.OST_MAX_VIDEO_BYTES / (1024 * 1024));
      note.textContent = `"${file.name}" is over ${limit} MB. Pick a smaller file instead.`;
      return;
    }
    note.textContent = "Storing video…";
    try {
      media.videoData = await readAsDataUrl(file);
      media.videoName = file.name;
      saveMedia();
      updateProfile({ videoSource: "folder", wallpaperKind: "video", wallpaperEnabled: true });
      note.textContent = folderName ? `Folder: ${folderName}` : "";
      renderGallery();
    } catch (err) {
      note.textContent = "That file couldn't be read.";
    }
  }

  /**
   * Miniatura leggera per la griglia della cartella: si legge il file una
   * sola volta per creare un object URL, molto piu' economico di farlo
   * passare per la stessa pipeline di normalizzazione usata per l'applicato
   * vero e proprio (qui serve solo un'anteprima, non il dato da salvare).
   */
  async function folderThumbUrl(fileHandle) {
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  }

  /** Legge il contenuto della cartella collegata e ne ricava le anteprime. */
  async function readFolder() {
    const note = el("folderNote");
    if (!folderHandle) {
      return;
    }
    // Le anteprime precedenti erano object URL: senza revoca resterebbero in
    // memoria per tutta la vita del popup.
    for (const entry of folderEntries) {
      if (entry.thumbUrl) {
        URL.revokeObjectURL(entry.thumbUrl);
      }
    }
    folderEntries = [];
    note.textContent = "Reading folder…";

    try {
      // FileSystemDirectoryHandle e' un iterabile "map-like": `.entries()` da'
      // le coppie [nome, handle], mentre `.values()` darebbe i soli handle.
      for await (const [name, handle] of folderHandle.entries()) {
        if (handle.kind !== "file") {
          continue;
        }
        const ext = ("." + name.split(".").pop()).toLowerCase();
        const isImage = Object.values(globalThis.OST_IMAGE_TYPES).some((exts) => exts.includes(ext));
        const isVideo = Object.values(globalThis.OST_VIDEO_TYPES).some((exts) => exts.includes(ext));
        if (!isImage && !isVideo) {
          continue;
        }
        const entry = {
          name,
          handle,
          kind: isImage ? "image" : "video",
          thumbUrl: "",
          usedAt: 0,
        };
        if (isImage) {
          try {
            entry.thumbUrl = await folderThumbUrl(handle);
          } catch (err) {
            // Anteprima non disponibile: la voce resta comunque selezionabile.
          }
        }
        folderEntries.push(entry);
      }
    } catch (err) {
      note.textContent = `Couldn't read that folder${err && err.message ? `: ${err.message}` : ""}.`;
      return;
    }

    const images = folderEntries.filter((e) => e.kind === "image").length;
    const videos = folderEntries.filter((e) => e.kind === "video").length;
    note.textContent = folderEntries.length
      ? `${images} image${images === 1 ? "" : "s"}, ${videos} video${videos === 1 ? "" : "s"} — images appear in the gallery.`
      : "No supported images or videos in this folder.";
  }

  /**
   * Apre il selettore di cartella nativo del sistema. Richiede un gesto
   * dell'utente (siamo dentro a un click, va bene) e funziona solo su contesti
   * che supportano la File System Access API — se assente si segnala invece di
   * fallire in silenzio.
   */
  async function pickFolder() {
    const note = el("folderNote");
    if (typeof window.showDirectoryPicker !== "function") {
      note.textContent = "This browser doesn't support choosing a local folder.";
      return;
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: "read" });
    } catch (err) {
      // L'utente ha semplicemente annullato la finestra: non e' un errore.
      return;
    }
    folderHandle = handle;
    folderPending = null;
    folderName = handle.name || "folder";

    // Una sola cartella alla volta: collegarne un'altra sostituisce la
    // precedente, sia in memoria sia nel record salvato.
    try {
      await idbPut(FOLDER_KEY, { handle: handle, name: folderName });
    } catch (err) {
      el("folderNote").textContent =
        "Folder linked for now, but it couldn't be remembered for next time.";
    }

    await readFolder();
    render();
  }

  // ------------------------------------------------------------------
  // Eventi
  // ------------------------------------------------------------------

  /** Slider che agisce su un valore globale. */
  function bindRange(id, apply) {
    el(id).addEventListener("input", (e) => {
      apply(Number(e.target.value));
      saveSettings();
    });
  }

  /** Slider che agisce sull'aspetto del dominio corrente. */
  function bindProfileRange(id, apply) {
    el(id).addEventListener("input", (e) => {
      apply(Number(e.target.value));
      saveProfile();
    });
  }

  function bind() {
    el("enabled").addEventListener("change", (e) =>
      update({ enabled: e.target.checked })
    );
    el("hideTrialBanner").addEventListener("change", (e) =>
      update({ hideTrialBanner: e.target.checked })
    );
    el("hideNeutralizeBanner").addEventListener("change", (e) =>
      update({ hideNeutralizeBanner: e.target.checked })
    );
    el("debugMode").addEventListener("change", (e) =>
      update({ debugMode: e.target.checked })
    );
    el("copyFieldNames").addEventListener("change", (e) =>
      update({ copyFieldNames: e.target.checked })
    );
    el("hideAppNames").addEventListener("change", (e) =>
      updateProfile({ hideAppNames: e.target.checked })
    );

    el("badgeEnabled").addEventListener("change", (e) =>
      update({ badgeEnabled: e.target.checked })
    );
    el("badgeHidden").addEventListener("change", (e) =>
      updateProfile({ badgeHidden: e.target.checked })
    );
    for (const btn of document.querySelectorAll(".corner")) {
      btn.addEventListener("click", () => update({ badgeCorner: btn.dataset.corner }));
    }
    // Delega: vale sia per il campione "auto" gia' presente nel markup sia per
    // quelli generati dalla palette, senza doverli collegare uno per uno.
    el("palette").addEventListener("click", (e) => {
      const swatch = e.target.closest(".sw[data-color]");
      if (swatch) {
        update({ badgeColor: swatch.dataset.color });
      }
    });
    el("badgeCustom").addEventListener("input", (e) =>
      update({ badgeColor: e.target.value })
    );
    bindRange("badgeSize", (v) => {
      settings.badgeSize = v;
      renderBadgeControls();
    });

    for (const id of ["iconBackground", "iconBorder", "iconEffect"]) {
      el(id).addEventListener("change", (e) => updateProfile({ [id]: e.target.value }));
    }
    for (const btn of document.querySelectorAll(".seg-btn[data-label]")) {
      btn.addEventListener("click", () => updateProfile({ labelColor: btn.dataset.label }));
    }

    el("wallpaperEnabled").addEventListener("change", (e) =>
      updateProfile({ wallpaperEnabled: e.target.checked })
    );

    el("addImageUrl").addEventListener("click", () =>
      handleImageUrl(el("imageUrl").value.trim())
    );
    el("imageUrl").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleImageUrl(e.target.value.trim());
      }
    });

    // Un solo pulsante per foto e video: il tipo si riconosce dal file dopo
    // la scelta, non prima. Vedi handleWallpaperFile().
    el("pickFile").addEventListener("click", () => el("wallpaperInput").click());
    el("wallpaperInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleWallpaperFile(file);
      }
      e.target.value = "";
    });
    el("pickFolder").addEventListener("click", () => pickFolder());
    el("unlinkFolder").addEventListener("click", unlinkFolder);
    el("reconnectFolder").addEventListener("click", reconnectFolder);

    el("libBack").addEventListener("click", () => showScreen("appearance"));

    for (const btn of document.querySelectorAll(".tab")) {
      btn.addEventListener("click", () => showScreen(btn.dataset.screen));
    }
    el("shellUi").addEventListener("change", (e) =>
      update({ shellUi: e.target.checked })
    );

    bindProfileRange("wallpaperDim", (v) => {
      profile.wallpaperDim = v / 100;
      el("dimOut").textContent = v + "%";
    });
    bindProfileRange("wallpaperBlur", (v) => {
      profile.wallpaperBlur = v;
      el("blurOut").textContent = v + "px";
    });

    el("roundIconsEnabled").addEventListener("change", (e) =>
      updateProfile({ roundIconsEnabled: e.target.checked })
    );
    for (const btn of document.querySelectorAll(".seg-btn[data-iconsize]")) {
      btn.addEventListener("click", () => updateProfile({ iconSize: btn.dataset.iconsize }));
    }
    bindProfileRange("iconRadius", (v) => {
      profile.iconRadius = v;
      el("radiusOut").textContent = v + "px";
      renderIconPreview();
    });

    el("copyDb").addEventListener("click", copyDatabase);
    el("recognizeBtn").addEventListener("click", recognizeDomain);

    el("reset").addEventListener("click", () => {
      settings = globalThis.ostNormalizeGlobal(null);
      profile = globalThis.ostNormalizeProfile(null);
      media = globalThis.ostNormalizeMedia(null);
      library = [];
      // Si azzerano gli interruttori globali e il solo dominio aperto: le
      // personalizzazioni degli altri progetti non vanno perse per errore.
      chrome.storage.local.set(
        {
          [KEY]: settings,
          [profileKey()]: profile,
          [mediaKey()]: media,
          [LIB_KEY]: library,
        },
        flash
      );
      showScreen("appearance");
      render();
    });
  }

  // ------------------------------------------------------------------
  // Database
  // ------------------------------------------------------------------

  function copyDatabase() {
    const name = el("dbname").dataset.full || "";
    if (!name) {
      return;
    }
    navigator.clipboard.writeText(name).then(() => {
      const btn = el("copyDb");
      btn.classList.add("done");
      setTimeout(() => btn.classList.remove("done"), 1200);
    });
  }

  /**
   * Nome del database e ambiente stanno nel DOM della pagina, non nell'URL:
   * li chiede al content script, con l'hostname come ripiego.
   */
  function askActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.url) {
          resolve(null);
          return;
        }
        let hostname = "";
        let origin = "";
        try {
          const u = new URL(tab.url);
          hostname = u.hostname;
          origin = u.origin;
        } catch (err) {
          resolve(null);
          return;
        }
        activeTabId = tab.id;
        activeTabOrigin = origin;
        chrome.tabs.sendMessage(tab.id, { type: "ost:database" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            // Nessuna risposta: sulla pagina non e' presente alcun content
            // script. Il popup lo usa per decidere se offrire il banner di
            // riconoscimento manuale del dominio.
            resolve({ host: hostname, database: "", environment: "", recognized: false });
            return;
          }
          resolve({
            host: hostname,
            database: response.database || "",
            environment: response.environment || "",
            recognized: true,
          });
        });
      });
    });
  }

  function showDatabase(database) {
    const label = el("dbname");
    const name = database || host;
    if (!name) {
      return;
    }
    label.textContent = name;
    label.dataset.full = name;
    el("dbchip").title = name;
  }

  // ------------------------------------------------------------------
  // Riconoscimento manuale del dominio
  // ------------------------------------------------------------------

  /**
   * Mostra il banner solo quando ha senso agire: un indirizzo http/https vero
   * (non una pagina interna del browser, dove il permesso non potrebbe
   * comunque funzionare) e soprattutto NON un dominio *.odoo.com/*.odoo.sh —
   * li' il content script parte da solo grazie al manifest, quindi offrire il
   * pulsante sarebbe ridondante. Questo controllo e' volutamente separato dal
   * segnale "recognized" (basato sulla risposta del content script): un
   * eventuale ritardo di caricamento non deve far comparire il banner su un
   * dominio Odoo standard.
   */
  function updateRecognizeBanner(recognized) {
    let isHttp = false;
    try {
      isHttp = /^https?:$/.test(new URL(activeTabOrigin).protocol);
    } catch (err) {
      isHttp = false;
    }
    const isStaticOdoo = globalThis.OST_STATIC_ODOO_RE.test(host);
    el("recognizeBanner").hidden = recognized || !isHttp || isStaticOdoo;
  }

  async function recognizeDomain() {
    const btn = el("recognizeBtn");
    btn.disabled = true;
    btn.textContent = "Requesting…";

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "ost:recognize-host", origin: activeTabOrigin, tabId: activeTabId },
        (r) => resolve(chrome.runtime.lastError ? null : r)
      );
    });

    if (!response || !response.ok) {
      btn.disabled = false;
      btn.textContent = "Enable here";
      el("recognizeBanner").querySelector(".hint").textContent =
        response && response.error === "permission denied"
          ? "Permission wasn't granted."
          : "Couldn't enable it here — try reloading the page.";
      return;
    }

    // Il content script e' ora iniettato nella scheda: si ricarica lo stato
    // del popup cosi' il resto dell'interfaccia (badge, aspetto, editor)
    // riflette subito il nuovo dominio invece di aspettare una riapertura.
    // Si richiama solo refreshState() e non start(): quest'ultimo rilegherebbe
    // ogni pulsante e duplicherebbe i campioni della palette colore.
    el("recognizeBanner").hidden = true;
    btn.disabled = false;
    btn.textContent = "Enable here";
    await refreshState();
  }

  // ------------------------------------------------------------------
  // Avvio
  // ------------------------------------------------------------------

  /**
   * Fino alla v0.4 aspetto e sfondo stavano nel record globale. Alla prima
   * apertura vengono copiati nel profilo di riferimento, cosi' ogni progetto
   * non ancora personalizzato conserva l'aspetto che l'utente aveva scelto.
   */
  function migrateLegacy(record) {
    const legacy = record[globalThis.OST_KEY_SETTINGS];
    const defaultKey = globalThis.ostProfileKey(globalThis.OST_DEFAULT_HOST);
    const defaultMediaKey = globalThis.ostMediaKey(globalThis.OST_DEFAULT_HOST);
    const patch = {};

    if (legacy && !record[defaultKey]) {
      patch[defaultKey] = globalThis.ostNormalizeProfile(legacy);
    }
    if (record[globalThis.OST_LEGACY_MEDIA] && !record[defaultMediaKey]) {
      patch[defaultMediaKey] = globalThis.ostNormalizeMedia(
        record[globalThis.OST_LEGACY_MEDIA]
      );
    }
    if (Object.keys(patch).length) {
      chrome.storage.local.set(patch);
    }
    return patch;
  }

  /**
   * Carica lo stato per la scheda attiva e ridisegna l'interfaccia. Non tocca
   * mai i gestori di evento: va bene richiamarla piu' volte nella stessa
   * apertura del popup (ad esempio dopo aver riconosciuto un dominio),
   * mentre bind() e buildPalette() vanno eseguiti una sola volta o
   * duplicherebbero pulsanti e ascoltatori.
   */
  async function refreshState() {
    const tab = await askActiveTab();
    host = (tab && tab.host) || "";
    environment = (tab && tab.environment) || globalThis.ostHostEnvironment(host, customHosts);
    profileHost = globalThis.ostIsOdooHost(host, customHosts) ? host : globalThis.OST_DEFAULT_HOST;
    updateRecognizeBanner(!!(tab && tab.recognized));

    const defaultProfileKey = globalThis.ostProfileKey(globalThis.OST_DEFAULT_HOST);
    const defaultMediaKey = globalThis.ostMediaKey(globalThis.OST_DEFAULT_HOST);
    const keys = [
      KEY,
      LIB_KEY,
      globalThis.OST_KEY_CUSTOM_HOSTS,
      profileKey(),
      defaultProfileKey,
      mediaKey(),
      defaultMediaKey,
      globalThis.OST_LEGACY_MEDIA,
    ];

    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (record) => {
        const store = record || {};
        const migrated = migrateLegacy(store);
        Object.assign(store, migrated);

        settings = globalThis.ostNormalizeGlobal(store[KEY]);
        customHosts = globalThis.ostNormalizeCustomHosts(store[globalThis.OST_KEY_CUSTOM_HOSTS]);
        profile = globalThis.ostNormalizeProfile(
          store[profileKey()] || store[defaultProfileKey] || store[KEY]
        );
        media = globalThis.ostNormalizeMedia(
          store[mediaKey()] || store[defaultMediaKey] || store[globalThis.OST_LEGACY_MEDIA]
        );
        library = globalThis.ostNormalizeLibrary(store[LIB_KEY]);

        // Lo stato di sola interfaccia riparte allineato al profilo appena
        // caricato: e' cosi' che si evita di mostrare, ad esempio, la scheda
        // "Cartella" per un dominio il cui sfondo salvato e' un link.

        // Uno sfondo scelto prima della libreria non deve sparire dalla
        // cronologia solo perche' l'utente ha aggiornato l'estensione.
        if (!library.length) {
          if (profile.imageSource === "url" && profile.imageUrl) {
            library.push({
              id: newId(),
              source: "url",
              url: profile.imageUrl,
              data: "",
              thumb: profile.imageUrl,
              name: "imported",
              size: 0,
              usedAt: Date.now(),
            });
            saveLibrary();
          } else if (media.imageData) {
            makeThumb(media.imageData).then((thumb) => {
              library.push({
                id: newId(),
                source: "file",
                url: "",
                data: media.imageData,
                thumb: thumb,
                name: "imported",
                size: media.imageData.length,
                usedAt: Date.now(),
              });
              saveLibrary();
              render();
            });
          }
        }

        render();
        showDatabase(tab && tab.database);
        resolve();
      });
    });
  }

  async function start() {
    await refreshState();
    buildPalette();
    buildIconSelects();
    bind();
    render();
    showScreen(settings.lastScreen || "appearance");
    // Dopo il primo disegno: la lettura della cartella e' asincrona e non deve
    // ritardare la comparsa del resto dell'interfaccia.
    restoreFolder();
  }

  start();
})();
