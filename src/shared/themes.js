/**
 * Generated CSS for the Odoo home menu: app icon styles, motion, animated
 * backdrops, the environment badge and caption colours.
 *
 * Only the `.o_app_icon` image is styled. Frames are drawn with padding,
 * borders and shadows on the image itself, so the DOM stays Odoo's and the
 * same rules work from 16 to 19. Motion animates the individual `translate`,
 * `scale` and `filter` properties, never `transform`, which Odoo uses for
 * drag and drop.
 */
(function () {
  "use strict";

  const HOME = "body.o_home_menu_background";
  const ICON = `${HOME} .o_apps .o_app_icon`;
  const TILE = `${HOME} .o_apps .o_app`;
  const CAPTION = `${HOME} .o_apps .o_app .o_caption`;

  const BAR_ITEMS = [
    `${HOME} .o_main_navbar`,
    `${HOME} .o_main_navbar button`,
    `${HOME} .o_main_navbar a`,
    `${HOME} .o_main_navbar i`,
    `${HOME} .o_main_navbar .oe_topbar_name`,
    `${HOME} .o_main_navbar .o_menu_toggle`,
  ].join(",\n");

  function rgba(hex, alpha) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  // Quick-pick accent pairs, shared by the icon and backdrop controls.
  globalThis.OST_ACCENTS = [
    ["#22e4ff", "#ff3fd8"],
    ["#7c5cff", "#22e4ff"],
    ["#00ff9c", "#00b3ff"],
    ["#ff3d6e", "#ffb800"],
    ["#ff7a18", "#af002d"],
    ["#b4ff39", "#00e0c6"],
    ["#e6e9f2", "#8a93a8"],
    ["#ffd23f", "#ff4ecd"],
  ];

  const SHAPES = {
    native: "",
    soft: "border-radius: 12px !important;",
    round: "border-radius: 22px !important;",
    circle: "border-radius: 50% !important;",
    chamfer: "border-radius: 0 !important; clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);",
  };

  /**
   * Each style returns the declarations for the icon and, optionally, extra
   * rules (keyframes) and a hover glow. `a` and `b` are the accent colours.
   */
  const STYLES = {
    none: () => ({ decl: [] }),
    neon: (a) => ({
      decl: [
        `box-shadow: 0 0 0 1.5px ${a}, 0 0 14px ${rgba(a, 0.75)}, 0 0 34px ${rgba(a, 0.35)} !important;`,
      ],
      hover: `box-shadow: 0 0 0 2px ${a}, 0 0 20px ${a}, 0 0 50px ${rgba(a, 0.55)} !important;`,
    }),
    holo: (a, b) => ({
      decl: [
        "border: 2px solid transparent !important;",
        `background: linear-gradient(#0b0d14, #0b0d14) padding-box, conic-gradient(from var(--ost-angle), ${a}, ${b}, ${a}) border-box !important;`,
        "animation: ost-holo 4s linear infinite;",
        `box-shadow: 0 0 18px ${rgba(a, 0.35)} !important;`,
      ],
      hover: `box-shadow: 0 0 26px ${rgba(b, 0.6)} !important;`,
      rules: `
        @property --ost-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
        @keyframes ost-holo { to { --ost-angle: 360deg; } }
      `,
      animated: true,
    }),
    glass: (a) => ({
      pad: 7,
      decl: [
        "background: linear-gradient(145deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05)) !important;",
        "border: 1px solid rgba(255, 255, 255, 0.3) !important;",
        "backdrop-filter: blur(14px) saturate(1.6);",
        "box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 8px 24px rgba(0, 0, 0, 0.25) !important;",
      ],
      hover: `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 0 1px ${rgba(a, 0.6)}, 0 12px 30px rgba(0, 0, 0, 0.3) !important;`,
    }),
    void: (a, b) => ({
      pad: 9,
      decl: [
        `background: radial-gradient(circle at 30% 20%, ${rgba(a, 0.35)}, transparent 60%), radial-gradient(circle at 80% 90%, ${rgba(b, 0.3)}, transparent 55%), #07080d !important;`,
        `border: 1px solid ${rgba(a, 0.45)} !important;`,
        "box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;",
      ],
      hover: `box-shadow: 0 0 0 1px ${a}, 0 0 24px ${rgba(a, 0.5)} !important;`,
    }),
    aurora: (a, b) => ({
      pad: 7,
      decl: [
        `background: linear-gradient(120deg, ${a}, ${b}, ${a}) 0 0 / 300% 300% !important;`,
        "animation: ost-aurora 6s ease-in-out infinite;",
        `box-shadow: 0 8px 22px ${rgba(b, 0.35)} !important;`,
      ],
      hover: `box-shadow: 0 10px 30px ${rgba(a, 0.55)} !important;`,
      rules: "@keyframes ost-aurora { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }",
      animated: true,
    }),
    chrome: () => ({
      decl: [
        "border: 2px solid transparent !important;",
        "background: linear-gradient(#f4f6fa, #c9ced8) padding-box, linear-gradient(160deg, #ffffff, #8d95a6 35%, #f4f6fa 55%, #5d6474) border-box !important;",
        "box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.4) !important;",
      ],
    }),
    ghost: (a) => ({
      decl: ["filter: grayscale(1) contrast(1.1) brightness(1.05);", "opacity: 0.72;"],
      hover: `filter: grayscale(0) drop-shadow(0 0 12px ${rgba(a, 0.7)}); opacity: 1;`,
    }),
  };

  const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  const MOTIONS = {
    none: {},
    levitate: { hover: "translate: 0 -7px;" },
    magnet: { hover: "scale: 1.12;", easing: SPRING },
    glitch: {
      hoverAnim: "ost-glitch 0.45s steps(2) infinite",
      rules: `@keyframes ost-glitch {
        0% { translate: 0 0; filter: drop-shadow(2px 0 #ff00c8) drop-shadow(-2px 0 #00f0ff); }
        25% { translate: -2px 1px; filter: drop-shadow(-3px 0 #ff00c8) drop-shadow(3px 0 #00f0ff); }
        50% { translate: 2px -1px; filter: drop-shadow(1px 0 #ff00c8) drop-shadow(-1px 0 #00f0ff) hue-rotate(40deg); }
        75% { translate: -1px 0; filter: drop-shadow(-2px 0 #ff00c8) drop-shadow(2px 0 #00f0ff); }
        100% { translate: 0 0; filter: none; }
      }`,
    },
    breathe: {
      idle: (a) => `ost-breathe-${a.slice(1)} 3.2s ease-in-out infinite`,
      rules: (a) => `@keyframes ost-breathe-${a.slice(1)} {
        0%, 100% { filter: drop-shadow(0 0 0 ${rgba(a, 0)}); }
        50% { filter: drop-shadow(0 0 12px ${rgba(a, 0.8)}); }
      }`,
    },
    drift: {
      idle: () => "ost-drift 5s ease-in-out infinite",
      rules: "@keyframes ost-drift { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }",
      // Every third icon is out of phase, so the grid ripples instead of bouncing as a block.
      stagger: true,
    },
  };

  const INTRO = `
    @keyframes ost-intro { from { opacity: 0; scale: 0.6; filter: blur(8px); } to { opacity: 1; scale: 1; filter: blur(0); } }
    ${TILE} { animation: ost-intro 0.55s ${SPRING} both; }
    ${Array.from({ length: 24 }, (_, i) => `${TILE}:nth-child(${i + 1}) { animation-delay: ${i * 0.035}s; }`).join("\n    ")}
  `;

  /** Builds the icon CSS for a profile. Returns "" for a fully neutral profile. */
  globalThis.ostIconCss = function (p) {
    const style = (STYLES[p.iconStyle] || STYLES.none)(p.iconAccent, p.iconAccent2);
    const motion = MOTIONS[p.iconMotion] || MOTIONS.none;
    const shape = SHAPES[p.iconShape] || "";
    const shrink = Math.round((100 - p.iconScale) * 0.35);
    const pad = (style.pad || 0) + shrink;

    const chunks = [];
    const decl = style.decl.slice();
    if (pad || style.decl.length) {
      decl.unshift("box-sizing: border-box !important;", `padding: ${pad}px !important;`);
    }
    if (shape) {
      decl.push(shape);
    }

    const anims = [];
    if (style.animated) {
      anims.push(/animation: ([^;]+);/.exec(decl.find((d) => d.startsWith("animation:")))[1]);
      decl.splice(decl.findIndex((d) => d.startsWith("animation:")), 1);
    }
    if (motion.idle) {
      anims.push(motion.idle(p.iconAccent));
    }
    if (anims.length) {
      decl.push(`animation: ${anims.join(", ")};`);
    }
    decl.push(`transition: translate 0.3s ${motion.easing || "ease"}, scale 0.3s ${motion.easing || "ease"}, filter 0.25s ease, opacity 0.25s ease, box-shadow 0.25s ease;`);

    const neutral = !style.decl.length && !shape && !pad && !motion.hover && !motion.idle && !motion.hoverAnim && !p.iconIntro;
    if (neutral) {
      return "";
    }

    chunks.push(`${ICON} {\n  ${decl.join("\n  ")}\n}`);

    const hover = [];
    if (motion.hover) hover.push(motion.hover);
    if (style.hover) hover.push(style.hover);
    if (motion.hoverAnim) hover.push(`animation: ${motion.hoverAnim};`);
    if (hover.length) {
      chunks.push(`${TILE}:hover .o_app_icon, ${TILE}:focus-visible .o_app_icon, ${TILE}.o_focused .o_app_icon {\n  ${hover.join("\n  ")}\n}`);
    }

    if (style.rules) chunks.push(style.rules);
    if (motion.rules) chunks.push(typeof motion.rules === "function" ? motion.rules(p.iconAccent) : motion.rules);
    if (motion.stagger) {
      chunks.push(`${TILE}:nth-child(3n+2) .o_app_icon { animation-delay: -1.6s; }\n${TILE}:nth-child(3n) .o_app_icon { animation-delay: -3.2s; }`);
    }
    if (p.iconIntro) chunks.push(INTRO);

    chunks.push(`@media (prefers-reduced-motion: reduce) { ${ICON}, ${TILE} { animation: none !important; transition: none !important; } }`);
    return chunks.join("\n");
  };

  /**
   * Animated backdrops. Drawn on a fixed pseudo-element behind the home menu,
   * so nothing is added to the DOM. `a` and `b` are the two palette colours.
   */
  const FX = {
    aurora: (a, b) => `
      background:
        radial-gradient(40% 50% at 20% 30%, ${rgba(a, 0.55)}, transparent 70%),
        radial-gradient(45% 55% at 80% 70%, ${rgba(b, 0.5)}, transparent 70%),
        radial-gradient(35% 40% at 60% 20%, ${rgba(b, 0.3)}, transparent 70%),
        #05060b;
      background-size: 160% 160%;
      animation: ost-fx-aurora 18s ease-in-out infinite alternate;
    `,
    nebula: (a, b) => `
      background:
        radial-gradient(1px 1px at 20% 30%, #fff, transparent),
        radial-gradient(1px 1px at 70% 80%, #fff, transparent),
        radial-gradient(1.5px 1.5px at 40% 60%, #fff, transparent),
        radial-gradient(1px 1px at 85% 20%, #fff, transparent),
        radial-gradient(60% 60% at 30% 40%, ${rgba(a, 0.4)}, transparent 70%),
        radial-gradient(50% 50% at 75% 65%, ${rgba(b, 0.4)}, transparent 70%),
        #030308;
      background-size: 240px 240px, 300px 300px, 200px 200px, 340px 340px, 100% 100%, 100% 100%, auto;
      animation: ost-fx-nebula 30s linear infinite;
    `,
    grid: (a, b) => `
      background:
        linear-gradient(to bottom, #04040a, transparent 55%),
        linear-gradient(${rgba(a, 0.6)} 1px, transparent 1px) 0 0 / 100% 44px,
        linear-gradient(90deg, ${rgba(a, 0.6)} 1px, transparent 1px) 0 0 / 44px 100%,
        radial-gradient(70% 90% at 50% 0%, ${rgba(b, 0.45)}, transparent 70%),
        #04040a;
      animation: ost-fx-grid 2.4s linear infinite;
    `,
    dots: (a, b) => `
      background:
        radial-gradient(${rgba(a, 0.7)} 1.2px, transparent 1.6px) 0 0 / 26px 26px,
        radial-gradient(70% 60% at 50% 100%, ${rgba(b, 0.35)}, transparent 70%),
        #06070c;
      animation: ost-fx-dots 6s linear infinite;
    `,
    scan: (a, b) => `
      background:
        linear-gradient(to bottom, transparent 0%, ${rgba(a, 0.22)} 50%, transparent 100%) 0 0 / 100% 240px no-repeat,
        repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px),
        radial-gradient(80% 70% at 50% 40%, ${rgba(b, 0.28)}, transparent 75%),
        #05060a;
      animation: ost-fx-scan 5s linear infinite;
    `,
  };

  const FX_KEYFRAMES = `
    @keyframes ost-fx-aurora { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
    @keyframes ost-fx-nebula { to { background-position: 240px 480px, -300px 300px, 200px -400px, -340px -340px, 0 0, 0 0, 0 0; } }
    @keyframes ost-fx-grid { to { background-position: 0 0, 0 44px, 0 0, 0 0, 0 0; } }
    @keyframes ost-fx-dots { to { background-position: 26px 26px, 0 0, 0 0; } }
    @keyframes ost-fx-scan { from { background-position: 0 -240px, 0 0, 0 0, 0 0; } to { background-position: 0 calc(100vh + 240px), 0 0, 0 0, 0 0; } }
  `;

  /** Declarations for a backdrop, reused by the popup for its thumbnails. */
  globalThis.ostFxBackground = function (fx, a, b) {
    return (FX[fx] || FX.aurora)(a, b);
  };
  globalThis.OST_FX_KEYFRAMES = FX_KEYFRAMES;

  globalThis.ostFxCss = function (p) {
    const dim = Number(p.wallpaperDim) || 0;
    // The grid fx needs a perspective tilt on its lower half only.
    const tilt = p.wallpaperFx === "grid"
      ? "transform: perspective(420px) rotateX(58deg); transform-origin: 50% 100%; top: 40%; inset-inline: -50%;"
      : "";
    return `
      ${HOME} { background: ${p.wallpaperFx === "grid" ? `radial-gradient(60% 45% at 50% 42%, ${rgba(p.wallpaperColor2, 0.35)}, transparent 70%), ` : ""}#05060b !important; }
      ${HOME} .o_home_menu { background: transparent !important; }
      ${HOME}::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        ${globalThis.ostFxBackground(p.wallpaperFx, p.wallpaperColor1, p.wallpaperColor2)}
        ${tilt}
      }
      ${dim > 0 ? `${HOME}::after { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: rgba(0, 0, 0, ${dim}); }` : ""}
      ${FX_KEYFRAMES}
      @media (prefers-reduced-motion: reduce) { ${HOME}::before { animation: none !important; } }
    `;
  };

  /** Not tied to the main menu: it's meant to show everywhere, to prevent editing the wrong database. */
  const CORNERS = {
    tl: "top: 8px; left: 8px;",
    tr: "top: 8px; right: 8px;",
    bl: "bottom: 8px; left: 8px;",
    br: "bottom: 8px; right: 8px;",
  };

  globalThis.ostBadgeCss = function (settings, env) {
    const color =
      settings.badgeColor === "auto"
        ? globalThis.OST_ENV_COLORS[env] || "#4a4f5e"
        : settings.badgeColor;
    const ink = globalThis.ostContrastInk(color);
    const size = Number(settings.badgeSize) || 12;

    return `
      #ost-env-badge {
        position: fixed;
        ${CORNERS[settings.badgeCorner] || CORNERS.tr}
        z-index: 2147483000;
        pointer-events: none;
        margin: 0;
        padding: ${Math.round(size * 0.28)}px ${Math.round(size * 0.75)}px;
        border-radius: ${Math.round(size * 0.5)}px;
        background: ${color};
        color: ${ink};
        font: 600 ${size}px/1.1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
      }
    `;
  };


  /**
   * Separate from the icon controls: dark Odoo text vanishes on a dark photo,
   * which is a readability issue independent of the icon style. The dark theme
   * also forces `font-size` and `font-weight`; in some views a more specific
   * Odoo rule made the caption tiny and the wrong color.
   */
  const LABELS = {
    auto: "",
    light: `
      ${CAPTION} {
        color: #ffffff !important;
        font-size: 0.8125rem !important;
        font-weight: 500 !important;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
      }
      ${BAR_ITEMS} {
        color: #ffffff !important;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
      }
    `,
    dark: `
      ${CAPTION} {
        color: #14161d !important;
        font-size: 0.8125rem !important;
        font-weight: 600 !important;
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.75);
      }
      ${BAR_ITEMS} { color: #14161d !important; }
    `,
  };

  globalThis.ostLabelCss = function (mode) {
    return LABELS[mode] || "";
  };

  /**
   * Script dock: a small pill in the bottom-left corner that opens into a
   * row of the user's script buttons on hover or focus.
   */
  globalThis.ostDockCss = function () {
    return `
      #ost-script-dock {
        position: fixed;
        left: 14px;
        bottom: 14px;
        z-index: 2147482000;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px;
        border: 1px solid rgba(34, 228, 255, 0.35);
        border-radius: 12px;
        background: rgba(7, 8, 13, 0.82);
        backdrop-filter: blur(12px);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.45), 0 0 18px rgba(34, 228, 255, 0.15);
        font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: 0.04em;
      }
      #ost-script-dock .ost-dock-handle {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border-radius: 8px;
        color: #22e4ff;
        cursor: default;
      }
      #ost-script-dock .ost-dock-list {
        display: flex;
        gap: 6px;
        max-width: 0;
        overflow: hidden;
        opacity: 0;
        transition: max-width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease;
      }
      #ost-script-dock:hover .ost-dock-list,
      #ost-script-dock:focus-within .ost-dock-list {
        max-width: 80vw;
        opacity: 1;
      }
      #ost-script-dock button {
        flex: none;
        height: 26px;
        padding: 0 10px;
        border: 1px solid var(--c);
        border-radius: 8px;
        background: color-mix(in srgb, var(--c) 14%, transparent);
        color: #eef2ff;
        font: inherit;
        white-space: nowrap;
        cursor: pointer;
        transition: background 0.15s ease, box-shadow 0.15s ease, translate 0.15s ease;
      }
      #ost-script-dock button:hover {
        background: color-mix(in srgb, var(--c) 30%, transparent);
        box-shadow: 0 0 14px color-mix(in srgb, var(--c) 60%, transparent);
        translate: 0 -1px;
      }
      #ost-script-dock button.ost-ok { box-shadow: 0 0 0 2px #00ff9c; }
      #ost-script-dock button.ost-err { box-shadow: 0 0 0 2px #ff3d6e; }
    `;
  };

  /** Copy confirmation toast. Bottom left, out of flow, ignores clicks so it never covers anything. */
  globalThis.ostToastCss = function () {
    return `
      #ost-copy-toast {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 2147483000;
        pointer-events: none;
        padding: 5px 11px;
        border-radius: 7px;
        background: rgba(18, 20, 27, 0.92);
        color: #ffffff;
        font: 500 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32);
      }
    `;
  };

  /**
   * Hides captions and enlarges icons. Independent switch, works with any
   * combination. Uses `transform`, not `width`, so the grid isn't reflowed
   * whatever base size Odoo picks.
   */
  globalThis.ostNoLabelsCss = function () {
    return `
      ${CAPTION} { display: none !important; }
      ${TILE} {
        justify-content: center !important;
        padding-top: 0.75rem !important;
        padding-bottom: 0.75rem !important;
      }
      ${ICON} { transform: scale(1.18); }
    `;
  };
})();
