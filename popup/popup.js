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
  let profileHost = globalThis.OST_DEFAULT_HOST;
  let environment = "";

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
      return library.find((e) => e.source === "url" && e.url === profile.imageUrl) || null;
    }
    return library.find((e) => e.source === "file" && e.data === media.imageData) || null;
  }

  /**
   * Aggiunge una voce evitando i doppioni: i link si confrontano per URL, i
   * file per nome e peso, che bastano a riconoscere lo stesso file scelto due
   * volte senza confrontare stringhe da megabyte.
   */
  function addToLibrary(entry) {
    const twin = library.find((e) =>
      entry.source === "url"
        ? e.source === "url" && e.url === entry.url
        : e.source === "file" && e.name === entry.name && e.size === entry.size
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
        wallpaperKind: "image",
        wallpaperEnabled: true,
      });
    } else {
      media.imageData = entry.data;
      saveMedia();
      updateProfile({ imageSource: "file", wallpaperKind: "image", wallpaperEnabled: true });
    }
  }

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

  function renderRecent() {
    const wrap = el("recentWrap");
    const entries = recentEntries();
    wrap.hidden = entries.length === 0;

    const box = el("recent");
    box.textContent = "";
    const active = activeEntry();

    for (const entry of entries) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.backgroundImage = `url("${entry.thumb}")`;
      btn.title = entry.name || entry.url;
      btn.setAttribute("aria-label", `Use ${entry.name || entry.url}`);
      btn.setAttribute("aria-current", String(entry === active));
      btn.addEventListener("click", () => applyEntry(entry));
      box.appendChild(btn);
    }
  }

  function renderLibrary() {
    const grid = el("libGrid");
    grid.textContent = "";
    el("libEmpty").hidden = library.length > 0;
    el("libCount").textContent = library.length ? `${library.length} saved` : "";

    const active = activeEntry();
    const entries = library.slice().sort((a, b) => b.usedAt - a.usedAt);

    for (const entry of entries) {
      const item = document.createElement("div");
      item.className = "lib-item";
      item.style.backgroundImage = `url("${entry.thumb}")`;
      item.setAttribute("aria-current", String(entry === active));

      const pick = document.createElement("button");
      pick.type = "button";
      pick.style.cssText =
        "position:absolute;inset:0;border:0;background:none;cursor:pointer";
      pick.setAttribute("aria-label", `Use ${entry.name || entry.url}`);
      pick.title = entry.name || entry.url;
      pick.addEventListener("click", () => {
        applyEntry(entry);
        showScreen("main");
      });

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

      item.appendChild(pick);
      item.appendChild(del);
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

    renderBadgeControls();

    selectGroup(".theme", "theme", profile.theme);
    selectGroup(".seg-btn[data-label]", "label", profile.labelColor);
    el("hideAppNames").checked = profile.hideAppNames;
    el("scopeNote").textContent =
      profileHost === globalThis.OST_DEFAULT_HOST
        ? "Appearance applies to every new project"
        : `Appearance saved for ${profileHost}`;

    el("wallpaperEnabled").checked = profile.wallpaperEnabled;
    el("wallpaperPanel").hidden = !profile.wallpaperEnabled;

    selectGroup(".seg-btn[data-kind]", "kind", profile.wallpaperKind);
    el("paneImage").hidden = profile.wallpaperKind !== "image";
    el("paneVideo").hidden = profile.wallpaperKind !== "video";

    selectGroup(".seg-btn[data-imgsrc]", "imgsrc", profile.imageSource);
    el("paneImageUrl").hidden = profile.imageSource !== "url";
    el("paneImageFile").hidden = profile.imageSource !== "file";
    el("imageUrl").value = profile.imageUrl;

    selectGroup(".seg-btn[data-vidsrc]", "vidsrc", profile.videoSource);
    el("paneVideoUrl").hidden = profile.videoSource !== "url";
    el("paneVideoFile").hidden = profile.videoSource !== "file";
    el("videoUrl").value = profile.videoUrl;

    el("imageNote").textContent = media.imageData
      ? `Current image: ${describeSize(media.imageData)}`
      : "No uploaded image in use.";
    el("videoNote").textContent = media.videoData
      ? `${media.videoName || "Stored video"} — ${describeSize(media.videoData)}`
      : "No video stored yet.";

    const dim = Math.round(profile.wallpaperDim * 100);
    el("wallpaperDim").value = dim;
    el("dimOut").textContent = dim + "%";
    el("wallpaperBlur").value = profile.wallpaperBlur;
    el("blurOut").textContent = profile.wallpaperBlur + "px";

    el("roundIconsEnabled").checked = profile.roundIconsEnabled;
    el("radiusPanel").hidden = !profile.roundIconsEnabled;
    el("iconRadius").value = profile.iconRadius;
    el("radiusOut").textContent = profile.iconRadius + "px";
    el("previewIcon").style.borderRadius = profile.iconRadius + "px";
    selectGroup(".seg-btn[data-iconsize]", "iconsize", profile.iconSize);

    renderRecent();
    if (!el("screenLibrary").hidden) {
      renderLibrary();
    }
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
    const lib = name === "library";
    el("screenMain").hidden = lib;
    el("screenLibrary").hidden = !lib;
    if (lib) {
      renderLibrary();
      el("libBack").focus();
    }
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
    const note = el("imageNote");
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
    } catch (err) {
      note.textContent = "That file couldn't be read. Try a PNG, JPG or WebP.";
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
      el("imageNote").textContent = "That doesn't look like a valid link.";
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
  }

  async function handleVideo(file) {
    const note = el("videoNote");
    if (file.size > globalThis.OST_MAX_VIDEO_BYTES) {
      const limit = Math.round(globalThis.OST_MAX_VIDEO_BYTES / (1024 * 1024));
      note.textContent = `That video is ${(file.size / (1024 * 1024)).toFixed(0)} MB. Keep uploads under ${limit} MB, or paste a link instead.`;
      return;
    }
    note.textContent = "Storing video…";
    try {
      media.videoData = await readAsDataUrl(file);
      media.videoName = file.name;
      saveMedia();
      updateProfile({ videoSource: "file", wallpaperKind: "video", wallpaperEnabled: true });
    } catch (err) {
      note.textContent = "That file couldn't be read. Try an MP4 or WebM.";
    }
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

    for (const btn of document.querySelectorAll(".theme")) {
      btn.addEventListener("click", () => updateProfile({ theme: btn.dataset.theme }));
    }
    for (const btn of document.querySelectorAll(".seg-btn[data-label]")) {
      btn.addEventListener("click", () => updateProfile({ labelColor: btn.dataset.label }));
    }

    el("wallpaperEnabled").addEventListener("change", (e) =>
      updateProfile({ wallpaperEnabled: e.target.checked })
    );

    for (const btn of document.querySelectorAll(".seg-btn[data-kind]")) {
      btn.addEventListener("click", () => updateProfile({ wallpaperKind: btn.dataset.kind }));
    }
    for (const btn of document.querySelectorAll(".seg-btn[data-imgsrc]")) {
      btn.addEventListener("click", () => updateProfile({ imageSource: btn.dataset.imgsrc }));
    }
    for (const btn of document.querySelectorAll(".seg-btn[data-vidsrc]")) {
      btn.addEventListener("click", () => updateProfile({ videoSource: btn.dataset.vidsrc }));
    }

    el("addImageUrl").addEventListener("click", () =>
      handleImageUrl(el("imageUrl").value.trim())
    );
    el("imageUrl").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleImageUrl(e.target.value.trim());
      }
    });

    el("pickImage").addEventListener("click", () => el("imageInput").click());
    el("imageInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleImageFile(file);
      }
      e.target.value = "";
    });

    let videoUrlTimer = null;
    el("videoUrl").addEventListener("input", (e) => {
      const value = e.target.value.trim();
      clearTimeout(videoUrlTimer);
      videoUrlTimer = setTimeout(() => {
        Object.assign(profile, { videoUrl: value, videoSource: "url" });
        saveProfile();
      }, 300);
    });

    el("pickVideo").addEventListener("click", () => el("videoInput").click());
    el("videoInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleVideo(file);
      }
      e.target.value = "";
    });
    el("clearVideo").addEventListener("click", () => {
      media.videoData = "";
      media.videoName = "";
      saveMedia();
      render();
    });

    el("openLibrary").addEventListener("click", () => showScreen("library"));
    el("libBack").addEventListener("click", () => showScreen("main"));

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
      el("previewIcon").style.borderRadius = v + "px";
    });

    el("copyDb").addEventListener("click", copyDatabase);

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
      showScreen("main");
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
        try {
          hostname = new URL(tab.url).hostname;
        } catch (err) {
          resolve(null);
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "ost:database" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            resolve({ host: hostname, database: "", environment: "" });
            return;
          }
          resolve({
            host: hostname,
            database: response.database || "",
            environment: response.environment || "",
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

  async function start() {
    const tab = await askActiveTab();
    host = (tab && tab.host) || "";
    environment = (tab && tab.environment) || globalThis.ostHostEnvironment(host);
    profileHost = globalThis.ostIsOdooHost(host) ? host : globalThis.OST_DEFAULT_HOST;

    const defaultProfileKey = globalThis.ostProfileKey(globalThis.OST_DEFAULT_HOST);
    const defaultMediaKey = globalThis.ostMediaKey(globalThis.OST_DEFAULT_HOST);
    const keys = [
      KEY,
      LIB_KEY,
      profileKey(),
      defaultProfileKey,
      mediaKey(),
      defaultMediaKey,
      globalThis.OST_LEGACY_MEDIA,
    ];

    chrome.storage.local.get(keys, (record) => {
      const store = record || {};
      const migrated = migrateLegacy(store);
      Object.assign(store, migrated);

      settings = globalThis.ostNormalizeGlobal(store[KEY]);
      profile = globalThis.ostNormalizeProfile(
        store[profileKey()] || store[defaultProfileKey] || store[KEY]
      );
      media = globalThis.ostNormalizeMedia(
        store[mediaKey()] || store[defaultMediaKey] || store[globalThis.OST_LEGACY_MEDIA]
      );
      library = globalThis.ostNormalizeLibrary(store[LIB_KEY]);

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

      buildPalette();
      render();
      bind();
      showDatabase(tab && tab.database);
    });
  }

  start();
})();
