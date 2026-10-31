/**
 * Media handling: decoding and downscaling images, thumbnails, the wallpaper
 * library and the linked local folder.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;

  // Wider images are resampled: a huge data URL would slow every page load.
  const MAX_IMAGE_WIDTH = 2560;
  const THUMB_SIZE = 360;
  const FOLDER_LIMIT = 60;

  const newId = () => "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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

  /** Resamples only when needed, so a small PNG stays lossless. */
  async function normalizeImage(dataUrl, { keepAlpha = false } = {}) {
    if (dataUrl.startsWith("data:image/svg")) {
      return dataUrl;
    }
    const img = await loadImage(dataUrl);
    if (img.naturalWidth <= MAX_IMAGE_WIDTH && dataUrl.length < 1.5 * 1024 * 1024) {
      return dataUrl;
    }
    const scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    // Logos keep their transparency, wallpapers do not need it.
    return keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  }

  /** Square thumbnail cropped from the centre. */
  async function makeThumb(dataUrl) {
    const img = await loadImage(dataUrl);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    canvas
      .getContext("2d")
      .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  /** First frame of a video, drawn from an off-page <video>. */
  function videoFirstFrame(dataUrl) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        video.remove();
        resolve(result);
      };
      // Frame 0 is often black, so capture a moment into the clip instead.
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = Math.min(1, (video.duration || 2) / 10);
        },
        { once: true }
      );
      video.addEventListener(
        "seeked",
        () => {
          try {
            const w = 320;
            const h = Math.round(w * ((video.videoHeight || 9) / (video.videoWidth || 16)));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(video, 0, 0, w, h);
            finish(canvas.toDataURL("image/jpeg", 0.7));
          } catch (err) {
            finish("");
          }
        },
        { once: true }
      );
      setTimeout(() => finish(""), 8000);
      video.addEventListener("error", () => finish(""), { once: true });
      video.src = dataUrl;
    });
  }

  // ------------------------------------------------------------------
  // Library
  // ------------------------------------------------------------------

  /** Adds an entry without duplicates: links match by URL, files by name and size. */
  function addToLibrary(entry) {
    const twin = store.library.find((e) =>
      entry.source === "url"
        ? e.source === "url" && e.url === entry.url
        : e.source !== "url" && e.name === entry.name && e.size === entry.size
    );
    if (twin) {
      twin.usedAt = Date.now();
      actions.saveLibrary();
      return twin;
    }
    entry.usedAt = Date.now();
    store.library.push(entry);
    if (store.library.length > globalThis.OST_LIBRARY_LIMIT) {
      const victim = store.library.slice().sort((a, b) => a.usedAt - b.usedAt)[0];
      store.library = store.library.filter((e) => e !== victim);
    }
    actions.saveLibrary();
    return entry;
  }

  function removeFromLibrary(entry) {
    store.library = store.library.filter((e) => e !== entry);
    actions.saveLibrary();
    actions.notify();
  }

  /** Makes an image entry the active wallpaper. */
  function applyImage(entry) {
    entry.usedAt = Date.now();
    actions.saveLibrary();
    if (entry.source === "url") {
      actions.setProfile({ imageSource: "url", imageUrl: entry.url, imageName: "", wallpaperKind: "image", wallpaperEnabled: true });
    } else {
      actions.setMedia({ imageData: entry.data });
      actions.setProfile({ imageSource: entry.source, imageName: entry.name, wallpaperKind: "image", wallpaperEnabled: true });
    }
  }

  function applyVideo(entry) {
    actions.setMedia({ videoData: entry.data, videoName: entry.name, videoThumb: entry.thumb || "" });
    actions.setProfile({ videoSource: entry.source, wallpaperKind: "video", wallpaperEnabled: true });
  }

  // ------------------------------------------------------------------
  // Imports. Each returns an error code, or "" on success.
  // ------------------------------------------------------------------

  async function importWallpaperFile(file) {
    if (globalThis.ostAllowedImage(file)) {
      try {
        const data = await normalizeImage(await readAsDataUrl(file));
        const thumb = await makeThumb(data);
        applyImage(addToLibrary({ id: newId(), source: "file", kind: "image", url: "", data, thumb, name: file.name, size: file.size }));
        return "";
      } catch (err) {
        return "read";
      }
    }
    if (globalThis.ostAllowedVideo(file)) {
      if (file.size > globalThis.OST_MAX_VIDEO_BYTES) {
        return "big";
      }
      try {
        const data = await readAsDataUrl(file);
        const thumb = await videoFirstFrame(data);
        applyVideo({ source: "file", data, name: file.name, thumb });
        return "";
      } catch (err) {
        return "read";
      }
    }
    return "format";
  }

  function importImageUrl(url) {
    let host;
    try {
      host = new URL(url).hostname;
    } catch (err) {
      return "url";
    }
    applyImage(addToLibrary({ id: newId(), source: "url", kind: "image", url, data: "", thumb: url, name: host, size: 0 }));
    return "";
  }

  function importVideoUrl(url) {
    try {
      new URL(url);
    } catch (err) {
      return "url";
    }
    actions.setProfile({ videoSource: "url", videoUrl: url, wallpaperKind: "video", wallpaperEnabled: true });
    return "";
  }

  /** Logos keep transparency and are capped in count. */
  async function importLogo(file) {
    if (!globalThis.ostAllowedImage(file)) {
      return "format";
    }
    if (store.media.logos.length >= globalThis.OST_MAX_LOGOS) {
      return "limit";
    }
    try {
      const data = await normalizeImage(await readAsDataUrl(file), { keepAlpha: true });
      const n = store.media.logos.length;
      // New logos are staggered so they do not stack exactly on top of each other.
      const logo = {
        id: newId(),
        data,
        name: file.name,
        x: 50 + ((n * 9) % 36) - 18,
        y: 50 + ((n * 13) % 30) - 15,
        size: 160,
        opacity: 1,
      };
      actions.setMedia({ logos: store.media.logos.concat(logo) });
      return "";
    } catch (err) {
      return "read";
    }
  }

  // ------------------------------------------------------------------
  // Linked folder
  // ------------------------------------------------------------------

  /*
   * A folder handle fits in IndexedDB but not in chrome.storage, which would
   * serialise it to an empty object. The folder is global (it is the user's
   * collection, not a per-project preference) and its images are converted at
   * link time, so it works on every project without asking permission again.
   */
  const IDB_NAME = "ost_handles";
  const IDB_STORE = "handles";
  const FOLDER_KEY = "wallpaperFolder";

  const folder = { name: "", entries: [], linked: false };

  function idb(mode, run) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction(IDB_STORE, mode);
        const request = run(tx.objectStore(IDB_STORE));
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  async function restoreFolder() {
    try {
      const saved = await idb("readonly", (s) => s.get(FOLDER_KEY));
      if (saved && Array.isArray(saved.entries) && saved.entries.length) {
        Object.assign(folder, { name: saved.name || "folder", entries: saved.entries, linked: true });
        actions.notify();
      }
    } catch (err) {
      // No cached folder, nothing to restore.
    }
  }

  async function readFolder(handle) {
    const entries = [];
    for await (const [name, child] of handle.entries()) {
      if (child.kind !== "file" || entries.length >= FOLDER_LIMIT) {
        continue;
      }
      const ext = ("." + name.split(".").pop()).toLowerCase();
      const isImage = Object.values(globalThis.OST_IMAGE_TYPES).some((x) => x.includes(ext));
      const isVideo = !isImage && Object.values(globalThis.OST_VIDEO_TYPES).some((x) => x.includes(ext));
      if (!isImage && !isVideo) {
        continue;
      }
      try {
        const file = await child.getFile();
        if (isImage) {
          const data = await normalizeImage(await readAsDataUrl(file));
          entries.push({ name, kind: "image", data, thumb: await makeThumb(data), size: file.size });
        } else if (file.size <= globalThis.OST_MAX_VIDEO_BYTES) {
          const data = await readAsDataUrl(file);
          entries.push({ name, kind: "video", data, thumb: await videoFirstFrame(data), size: file.size });
        }
      } catch (err) {
        // One unreadable file must not abort the rest.
      }
    }
    return entries;
  }

  /** Returns "", "unsupported", "cancelled" or an error message. */
  async function linkFolder(onProgress) {
    if (typeof window.showDirectoryPicker !== "function") {
      return "unsupported";
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: "read" });
    } catch (err) {
      return "cancelled";
    }
    onProgress();
    try {
      const entries = await readFolder(handle);
      Object.assign(folder, { name: handle.name || "folder", entries, linked: true });
      await idb("readwrite", (s) => s.put({ name: folder.name, entries }, FOLDER_KEY));
    } catch (err) {
      return (err && err.message) || "error";
    }
    actions.notify();
    return "";
  }

  async function unlinkFolder() {
    Object.assign(folder, { name: "", entries: [], linked: false });
    try {
      await idb("readwrite", (s) => s.delete(FOLDER_KEY));
    } catch (err) {
      // Nothing cached, nothing to delete.
    }
    actions.notify();
  }

  ns.media = {
    folder,
    newId,
    addToLibrary,
    removeFromLibrary,
    applyImage,
    applyVideo,
    importWallpaperFile,
    importImageUrl,
    importVideoUrl,
    importLogo,
    restoreFolder,
    linkFolder,
    unlinkFolder,
  };
})(globalThis.OstPopup);
