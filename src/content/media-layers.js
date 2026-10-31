/**
 * Fixed layers behind the home menu: the video wallpaper and the logos that
 * sit above any wallpaper.
 */
(function (ns) {
  "use strict";

  // Source currently mounted in the <video> tag. Tells us whether the layer
  // must be rebuilt or whether a CSS update is enough.
  let mountedVideoSource = "";
  let videoObjectUrl = "";

  // ------------------------------------------------------------------
  // Video
  // ------------------------------------------------------------------

  function releaseObjectUrl() {
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      videoObjectUrl = "";
    }
  }

  function removeVideoLayer() {
    const layer = document.getElementById(ns.LAYER_ID);
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
      document.body.classList.remove(ns.VIDEO_ON_CLASS);
    }
  }

  /**
   * A data URL of several MB in a src attribute stalls the parser and stops
   * the browser from buffering. Convert it to a Blob and stream it through an
   * object URL instead.
   */
  async function resolveVideoSrc() {
    releaseObjectUrl();
    const source = ns.wallpaper.activeVideo();
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
    if (!document.body || document.getElementById(ns.LAYER_ID)) {
      return;
    }

    const layer = document.createElement("div");
    layer.id = ns.LAYER_ID;
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
    // An unplayable source falls back to Odoo's own background rather than
    // leaving the page blank.
    video.addEventListener("error", removeVideoLayer, { once: true });

    const veil = document.createElement("div");
    veil.className = "ost-media-veil";

    layer.appendChild(video);
    layer.appendChild(veil);
    // First child of <body>: with a negative z-index it stays behind the app
    // without taking part in the layout.
    document.body.insertBefore(layer, document.body.firstChild);
    document.body.classList.add(ns.VIDEO_ON_CLASS);

    try {
      mountedVideoSource = ns.wallpaper.activeVideo();
      video.src = await resolveVideoSrc();
    } catch (err) {
      removeVideoLayer();
      return;
    }
    syncVideoPlayback();
  }

  /** Plays the video only while the home menu is visible. */
  function syncVideoPlayback() {
    const video = document.querySelector(`#${ns.LAYER_ID} video`);
    if (!video || !document.body) {
      return;
    }
    const visible = !document.hidden && document.body.classList.contains("o_home_menu_background");

    if (visible) {
      const promise = video.play();
      if (promise && typeof promise.catch === "function") {
        // Autoplay can be rejected. The first frame stays visible, so this is
        // not worth surfacing.
        promise.catch(() => {});
      }
    } else {
      video.pause();
    }
  }

  function applyMediaLayer() {
    if (ns.wallpaper.wallpaperMode() !== "video") {
      removeVideoLayer();
      return;
    }
    if (mountedVideoSource && mountedVideoSource !== ns.wallpaper.activeVideo()) {
      removeVideoLayer();
    }
    ensureVideoLayer();
  }

  // ------------------------------------------------------------------
  // Logos
  // ------------------------------------------------------------------

  function removeLogoLayer() {
    const layer = document.getElementById(ns.LOGO_LAYER_ID);
    if (layer) {
      layer.remove();
    }
  }

  /**
   * Draws every logo above the wallpaper, whatever its kind. Logos are data
   * URLs already, so no object URL is needed. The layer is rebuilt only when
   * the list actually changed.
   */
  function applyLogoLayer() {
    const { settings, media } = ns.state;
    if (!settings.enabled || !media.logos.length || !document.body) {
      removeLogoLayer();
      return;
    }
    const signature = JSON.stringify(media.logos);
    let layer = document.getElementById(ns.LOGO_LAYER_ID);
    if (layer && layer.dataset.ostSig === signature) {
      return;
    }
    if (!layer) {
      layer = document.createElement("div");
      layer.id = ns.LOGO_LAYER_ID;
      layer.setAttribute("aria-hidden", "true");
      document.body.insertBefore(layer, document.body.firstChild);
    }
    layer.dataset.ostSig = signature;
    layer.textContent = "";
    for (const logo of media.logos) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = logo.data;
      img.style.width = logo.size + "px";
      img.style.left = logo.x + "%";
      img.style.top = logo.y + "%";
      img.style.opacity = String(logo.opacity);
      // A broken logo is skipped, the rest stay.
      img.addEventListener("error", () => img.remove(), { once: true });
      layer.appendChild(img);
    }
  }

  ns.mediaLayers = {
    applyMediaLayer,
    applyLogoLayer,
    ensureVideoLayer,
    removeVideoLayer,
    removeLogoLayer,
    syncVideoPlayback,
  };
})(globalThis.OstContent);
