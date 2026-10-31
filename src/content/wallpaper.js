/**
 * Wallpaper selection and the CSS it needs on the home menu.
 */
(function (ns) {
  "use strict";

  const LAYER_ID = "ost-media-layer";
  const LOGO_LAYER_ID = "ost-logos-layer";

  ns.LAYER_ID = LAYER_ID;
  ns.LOGO_LAYER_ID = LOGO_LAYER_ID;
  ns.VIDEO_ON_CLASS = "ost-video-on";

  /** Makes a URL safe to embed in a CSS url("...") declaration. */
  function cssUrl(value) {
    if (!value) {
      return "";
    }
    if (value.startsWith("data:")) {
      // Quotes, parentheses and newlines would end the value early and let
      // the rest be parsed as extra declarations.
      return `url("${String(value).replace(/["\\\r\n()]/g, encodeURIComponent)}")`;
    }
    const safe = String(value).replace(/["'()\\\s]/g, encodeURIComponent);
    return `url("${safe}")`;
  }

  function activeImage() {
    const { profile, media } = ns.state;
    // "file" and "folder" are both embedded in media.imageData. The source
    // only matters to the popup, which picks a library icon from it.
    if (profile.imageSource === "file" || profile.imageSource === "folder") {
      return media.imageData;
    }
    return profile.imageUrl;
  }

  function activeVideo() {
    const { profile, media } = ns.state;
    if (profile.videoSource === "file" || profile.videoSource === "folder") {
      return media.videoData;
    }
    return profile.videoUrl;
  }

  /** Returns "none", "fx", "color", "image" or "video". */
  function wallpaperMode() {
    const { settings, profile } = ns.state;
    // The master switch wins over everything. Without this check the video
    // layer and the body class stayed in the page with the extension off.
    if (!settings.enabled || !profile.wallpaperEnabled) {
      return "none";
    }
    if (profile.wallpaperKind === "fx") {
      return "fx";
    }
    if (profile.wallpaperKind === "color") {
      // Colours and gradients need no external data, unlike images and video.
      return "color";
    }
    if (profile.wallpaperKind === "video") {
      return activeVideo() ? "video" : "none";
    }
    return activeImage() ? "image" : "none";
  }

  function imageCss(profile, dim, blur) {
    const url = cssUrl(activeImage());
    // The constant gradient acts as a dimming veil. It comes first in the
    // background-image stack, so it is painted on top of the picture.
    const veil = dim > 0 ? `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), ` : "";
    const chunks = [`
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
    `];

    if (blur > 0) {
      // Blurring the body background would blur its children too, so the
      // picture moves to a pseudo-element behind the content.
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
    return chunks;
  }

  function colorCss(profile, dim) {
    // Always a background-image layer, never a bare background-color, so the
    // dimming veil can be stacked on top the same way as for pictures.
    const flat = `linear-gradient(${profile.wallpaperColor1}, ${profile.wallpaperColor1})`;
    const gradient = `linear-gradient(${profile.wallpaperAngle}deg, ${profile.wallpaperColor1}, ${profile.wallpaperColor2})`;
    const base = profile.wallpaperGradient ? gradient : flat;
    const veil = dim > 0 ? `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), ` : "";
    const chunks = [`
      body.o_home_menu_background {
        background-image: ${veil}${base} !important;
        background-attachment: fixed !important;
      }
      body.o_home_menu_background .o_home_menu {
        background-image: none !important;
        background-color: transparent !important;
      }
    `];

    return chunks;
  }

  function logosCss() {
    return `
      #${LOGO_LAYER_ID} {
        position: fixed;
        inset: 0;
        z-index: -1;
        overflow: hidden;
        pointer-events: none;
      }
      body:not(.o_home_menu_background) #${LOGO_LAYER_ID} { display: none; }
      #${LOGO_LAYER_ID} img {
        position: absolute;
        transform: translate(-50%, -50%);
        max-width: none;
        height: auto;
      }
    `;
  }

  function videoCss(dim, blur) {
    const on = `body.${ns.VIDEO_ON_CLASS}.o_home_menu_background`;
    return [`
      ${on} {
        background-image: none !important;
        background-color: transparent !important;
      }
      ${on} .o_home_menu {
        background-image: none !important;
        background-color: transparent !important;
      }
      #${LAYER_ID} {
        position: fixed;
        inset: 0;
        z-index: -2;
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
    `];
  }

  /** CSS for the active wallpaper mode, as a list of chunks. */
  function wallpaperCss() {
    const { profile } = ns.state;
    const dim = Number(profile.wallpaperDim) || 0;
    const blur = Number(profile.wallpaperBlur) || 0;

    let chunks = [];
    switch (wallpaperMode()) {
      case "image":
        chunks = imageCss(profile, dim, blur);
        break;
      case "fx":
        chunks = [globalThis.ostFxCss(profile)];
        break;
      case "color":
        chunks = colorCss(profile, dim);
        break;
      case "video":
        chunks = videoCss(dim, blur);
        break;
      default:
        break;
    }
    // Logos sit above every wallpaper kind, so they are independent of it.
    if (ns.state.settings.enabled && ns.state.media.logos.length) {
      chunks.push(logosCss());
    }
    return chunks;
  }

  ns.wallpaper = { activeVideo, wallpaperMode, wallpaperCss };
})(globalThis.OstContent);
