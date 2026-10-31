/**
 * Shared config for the content script and the popup.
 *
 * Storage is split by scope (global settings, per-host profile, per-host
 * media, library) so a page only loads the keys that belong to its host.
 * Everything defaults to off: a fresh install must not touch any page.
 */
(function () {
  "use strict";

  const G = globalThis;

  G.OST_KEY_SETTINGS = "ost_settings";
  G.OST_KEY_LIBRARY = "ost_library";
  // User scripts shown as buttons in the Developer tab and the page dock.
  G.OST_KEY_SCRIPTS = "ost_scripts";
  // Hosts outside *.odoo.com / *.odoo.sh that the user marked as Odoo (e.g. localhost).
  G.OST_KEY_CUSTOM_HOSTS = "ost_custom_hosts";
  G.OST_PROFILE_PREFIX = "ost_profile:";
  G.OST_MEDIA_PREFIX = "ost_media:";
  // Profile used when the active tab is not an Odoo page.
  G.OST_DEFAULT_HOST = "*";

  /**
   * Accepted upload formats. `accept="image/*"` only filters the file picker,
   * so real validation checks the MIME type and falls back to the extension.
   * AVI and similar containers are excluded: most codecs inside them cannot be
   * decoded by a <video> tag.
   */
  G.OST_IMAGE_TYPES = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
    "image/svg+xml": [".svg"],
  };
  G.OST_VIDEO_TYPES = {
    "video/mp4": [".mp4", ".m4v"],
    "video/webm": [".webm"],
    "video/ogg": [".ogv", ".ogg"],
  };

  function extensionOf(name) {
    const m = /\.[a-z0-9]+$/i.exec(String(name || ""));
    return m ? m[0].toLowerCase() : "";
  }

  function isAllowed(file, table) {
    if (!file) {
      return false;
    }
    if (file.type && table[file.type]) {
      return true;
    }
    // Some Linux builds report no MIME type.
    return Object.values(table).some((exts) => exts.includes(extensionOf(file.name)));
  }

  G.ostAllowedImage = (file) => isAllowed(file, G.OST_IMAGE_TYPES);
  G.ostAllowedVideo = (file) => isAllowed(file, G.OST_VIDEO_TYPES);

  G.ostProfileKey = (host) => G.OST_PROFILE_PREFIX + (host || G.OST_DEFAULT_HOST);
  G.ostMediaKey = (host) => G.OST_MEDIA_PREFIX + (host || G.OST_DEFAULT_HOST);

  // Larger videos are rejected (use a link): a big data URL slows every page load.
  G.OST_MAX_VIDEO_BYTES = 24 * 1024 * 1024;
  G.OST_MAX_LOGOS = 12;
  G.OST_LIBRARY_LIMIT = 24;
  G.OST_MAX_SCRIPTS = 40;
  G.OST_MAX_SCRIPT_LENGTH = 100000;

  G.OST_CORNERS = ["tl", "tr", "bl", "br"];
  G.OST_TABS = ["wallpaper", "icons", "logos", "workspace", "developer", "settings"];
  G.OST_LABEL_MODES = ["auto", "light", "dark"];
  G.OST_ICON_STYLES = ["none", "neon", "holo", "glass", "void", "aurora", "chrome", "ghost"];
  G.OST_ICON_MOTIONS = ["none", "levitate", "magnet", "glitch", "breathe", "drift"];
  G.OST_ICON_SHAPES = ["native", "soft", "round", "circle", "chamfer"];
  G.OST_WALLPAPER_KINDS = ["fx", "color", "image", "video"];
  G.OST_WALLPAPER_FX = ["aurora", "grid", "nebula", "dots", "scan"];

  // Badge colour when set to "auto".
  G.OST_ENV_COLORS = { PROD: "#d0442c", STAGING: "#c9761e", DEV: "#1f7a4d" };

  /** Global switches, shared by every project. */
  G.OST_GLOBAL_DEFAULTS = {
    enabled: false,
    language: "en",
    lastTab: "wallpaper",
    // Reveals the Developer tab. The features inside have their own switches.
    developerSection: false,
    debugMode: false,
    copyFieldNames: false,
    // Adds the odoo-bin shell / psql entries and file-browser commands in the Odoo.sh editor.
    shellUi: false,
    // Floating bar with the user's script buttons on Odoo pages.
    scriptDock: false,
    badgeEnabled: false,
    badgeCorner: "tr",
    badgeSize: 12,
    badgeColor: "auto",
  };

  /** Look and feel, stored per domain. */
  G.OST_PROFILE_DEFAULTS = {
    hideTrialBanner: false,
    hideNeutralizeBanner: false,
    badgeHidden: false,

    // App icons. Style "none" with motion "none" leaves Odoo's icons alone.
    iconsEnabled: false,
    iconStyle: "none",
    iconAccent: "#22e4ff",
    iconAccent2: "#ff3fd8",
    iconMotion: "none",
    iconShape: "native",
    // Percentage of the frame the artwork fills.
    iconScale: 100,
    // Icons fade in one after another when the home menu opens.
    iconIntro: false,
    labelColor: "auto",
    hideAppNames: false,

    // Wallpaper.
    wallpaperEnabled: false,
    wallpaperKind: "fx",
    wallpaperFx: "aurora",
    imageSource: "url",
    imageUrl: "",
    // Name of an uploaded/folder file, used to mark the active gallery entry.
    imageName: "",
    videoSource: "url",
    videoUrl: "",
    wallpaperDim: 0.2,
    wallpaperBlur: 0,
    wallpaperColor1: "#22e4ff",
    wallpaperColor2: "#ff3fd8",
    wallpaperGradient: true,
    wallpaperAngle: 145,
  };

  G.OST_MEDIA_DEFAULTS = {
    imageData: "",
    videoData: "",
    videoName: "",
    // First frame of an uploaded video, which has no other preview source.
    videoThumb: "",
    // Logos placed over any wallpaper: {id, data, name, x, y, size, opacity}.
    logos: [],
  };

  const HEX = /^#[0-9a-f]{6}$/i;

  function pick(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function color(value, fallback) {
    return HEX.test(String(value)) ? String(value) : fallback;
  }

  /** Merges stored values over the defaults and drops anything unknown. */
  function merge(defaults, raw) {
    const out = Object.assign({}, defaults);
    for (const key of Object.keys(defaults)) {
      if (raw && key in raw && typeof raw[key] === typeof defaults[key]) {
        out[key] = raw[key];
      }
    }
    return out;
  }

  G.ostNormalizeGlobal = function (raw) {
    const g = merge(G.OST_GLOBAL_DEFAULTS, raw);
    g.badgeCorner = pick(g.badgeCorner, G.OST_CORNERS, "tr");
    g.badgeSize = clamp(g.badgeSize, 9, 22, 12);
    if (g.badgeColor !== "auto") {
      g.badgeColor = color(g.badgeColor, "auto");
    }
    g.lastTab = pick(g.lastTab, G.OST_TABS, "wallpaper");
    const languages = (G.OST_LANGUAGES || []).map((l) => l.code);
    if (languages.length && !languages.includes(g.language)) {
      g.language = "en";
    }
    return g;
  };

  G.ostNormalizeProfile = function (raw) {
    const p = merge(G.OST_PROFILE_DEFAULTS, raw);
    const d = G.OST_PROFILE_DEFAULTS;
    p.iconStyle = pick(p.iconStyle, G.OST_ICON_STYLES, "none");
    p.iconMotion = pick(p.iconMotion, G.OST_ICON_MOTIONS, "none");
    p.iconShape = pick(p.iconShape, G.OST_ICON_SHAPES, "native");
    p.labelColor = pick(p.labelColor, G.OST_LABEL_MODES, "auto");
    p.wallpaperKind = pick(p.wallpaperKind, G.OST_WALLPAPER_KINDS, "fx");
    p.wallpaperFx = pick(p.wallpaperFx, G.OST_WALLPAPER_FX, "aurora");
    p.imageSource = pick(p.imageSource, ["url", "file", "folder"], "url");
    p.videoSource = pick(p.videoSource, ["url", "file", "folder"], "url");
    for (const key of ["iconAccent", "iconAccent2", "wallpaperColor1", "wallpaperColor2"]) {
      p[key] = color(p[key], d[key]);
    }
    p.wallpaperAngle = clamp(p.wallpaperAngle, 0, 360, d.wallpaperAngle);
    p.iconScale = clamp(p.iconScale, 60, 100, 100);
    p.wallpaperDim = clamp(p.wallpaperDim, 0, 0.9, d.wallpaperDim);
    p.wallpaperBlur = clamp(p.wallpaperBlur, 0, 24, 0);
    return p;
  };

  G.ostNormalizeMedia = function (raw) {
    const m = merge(G.OST_MEDIA_DEFAULTS, raw);
    const source = raw && Array.isArray(raw.logos) ? raw.logos : [];
    m.logos = source
      .filter((l) => l && typeof l.data === "string" && l.data)
      .slice(0, G.OST_MAX_LOGOS)
      .map((l) => ({
        id: String(l.id || ""),
        data: l.data,
        name: String(l.name || ""),
        x: clamp(l.x, 0, 100, 50),
        y: clamp(l.y, 0, 100, 50),
        size: clamp(l.size, 24, 800, 160),
        opacity: clamp(l.opacity, 0.05, 1, 1),
      }));
    return m;
  };

  /** Script buttons: {id, name, color, code}. */
  G.ostNormalizeScripts = function (raw) {
    return (Array.isArray(raw) ? raw : [])
      .filter((s) => s && typeof s.id === "string" && s.id && typeof s.code === "string")
      .slice(0, G.OST_MAX_SCRIPTS)
      .map((s) => ({
        id: s.id,
        name: String(s.name || "").slice(0, 40) || "Script",
        color: color(s.color, "#22e4ff"),
        code: s.code.slice(0, G.OST_MAX_SCRIPT_LENGTH),
      }));
  };

  G.ostNormalizeLibrary = function (raw) {
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object" && e.id) : [];
  };

  G.ostNormalizeCustomHosts = function (raw) {
    return Array.isArray(raw) ? raw.filter((h) => typeof h === "string" && h) : [];
  };

  // Shared by auto-detection and the popup's "enable here" banner, so both
  // agree on what already counts as a standard Odoo domain.
  G.OST_STATIC_ODOO_RE = /(^|\.)odoo\.(com|sh)$/i;

  /**
   * A host counts as Odoo if it matches *.odoo.com / *.odoo.sh or the user
   * marked it by hand. The manual list is passed in so the function works the
   * same in the content script and the popup.
   */
  G.ostIsOdooHost = function (hostname, customHosts) {
    const host = String(hostname || "");
    return G.OST_STATIC_ODOO_RE.test(host) || (Array.isArray(customHosts) && customHosts.includes(host));
  };

  /**
   * Environment from the hostname alone. ".dev." cannot mean development: on
   * Odoo.sh every branch, production included, lives under `.dev.odoo.com`,
   * so development is detected from the page banner instead. Bare `odoo.com`
   * and `www` get no badge since they are nobody's database.
   */
  G.ostHostEnvironment = function (hostname, customHosts) {
    const host = String(hostname || "").toLowerCase();
    if (!G.ostIsOdooHost(host, customHosts)) {
      return "";
    }
    if (/staging/.test(host)) {
      return "STAGING";
    }
    const labels = host.split(".");
    const base = labels.slice(-2).join(".");
    const sub = labels.slice(0, -2).filter((l) => l && l !== "www");
    if (!sub.length) {
      return "";
    }
    return base === "odoo.sh" ? "" : "PROD";
  };

  /** White or near-black, whichever reads better on the given colour. */
  G.ostContrastInk = function (hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) {
      return "#ffffff";
    }
    const n = parseInt(m[1], 16);
    const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luminance > 0.62 ? "#1b1e29" : "#ffffff";
  };
})();
