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
    // Liquid glass: heavy blur and saturation, a bright rim that fades
    // around the edge, and a soft inner sheen like light bending in a lens.
    glass: (a) => ({
      pad: 8,
      decl: [
        "border: 1.5px solid transparent !important;",
        "background: linear-gradient(160deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06) 45%, rgba(255, 255, 255, 0.14)) padding-box, linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.15) 35%, rgba(255, 255, 255, 0.05) 65%, rgba(255, 255, 255, 0.7)) border-box !important;",
        "backdrop-filter: blur(18px) saturate(1.9) brightness(1.08);",
        "box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.7), inset 0 -10px 18px rgba(255, 255, 255, 0.1), inset 0 8px 14px rgba(255, 255, 255, 0.12), 0 12px 32px rgba(0, 0, 0, 0.22) !important;",
      ],
      hover: `box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.85), inset 0 -10px 18px rgba(255, 255, 255, 0.16), inset 0 8px 14px rgba(255, 255, 255, 0.18), 0 0 0 1px ${rgba(a, 0.35)}, 0 16px 40px rgba(0, 0, 0, 0.28) !important;`,
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
    chrome: () => ({
      decl: [
        "border: 2px solid transparent !important;",
        "background: linear-gradient(#f4f6fa, #c9ced8) padding-box, linear-gradient(160deg, #ffffff, #8d95a6 35%, #f4f6fa 55%, #5d6474) border-box !important;",
        "box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.4) !important;",
      ],
    }),
    titanium: () => ({
      pad: 7,
      decl: [
        "border: 2px solid transparent !important;",
        "background: linear-gradient(160deg, #3a3e46, #23262c) padding-box, linear-gradient(150deg, #9aa1ad, #4a4f58 40%, #c3c8d0 60%, #3d4148) border-box !important;",
        "box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 22px rgba(0, 0, 0, 0.4) !important;",
      ],
    }),
    porcelain: () => ({
      pad: 8,
      decl: [
        "background: linear-gradient(180deg, #ffffff, #eef0f3) !important;",
        "border: 1px solid rgba(0, 0, 0, 0.06) !important;",
        "box-shadow: inset 0 1px 0 #ffffff, inset 0 -2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.08), 0 8px 20px rgba(0, 0, 0, 0.12) !important;",
      ],
      hover: "box-shadow: inset 0 1px 0 #ffffff, inset 0 -2px 4px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.08), 0 14px 30px rgba(0, 0, 0, 0.16) !important;",
    }),
    obsidian: () => ({
      pad: 8,
      decl: [
        "background: linear-gradient(165deg, #34343a, #0c0c0f 55%, #18181c) !important;",
        "border: 1px solid rgba(255, 255, 255, 0.08) !important;",
        "box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 12px 16px -12px rgba(255, 255, 255, 0.18), 0 10px 26px rgba(0, 0, 0, 0.45) !important;",
      ],
    }),
    carbon: () => ({
      pad: 8,
      decl: [
        "background: linear-gradient(160deg, rgba(255, 255, 255, 0.08), transparent 50%), repeating-linear-gradient(45deg, #1b1c1f 0 3px, #26282c 3px 6px) !important;",
        "border: 1px solid #000000 !important;",
        "box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 22px rgba(0, 0, 0, 0.45) !important;",
      ],
    }),
  };

  const SMOOTH = "cubic-bezier(0.22, 1, 0.36, 1)";
  const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  /**
   * Hover motion only, with slow eased transitions. `tile` adds rules on the
   * tile itself, `group` on the other tiles while one is hovered.
   */
  const MOTIONS = {
    none: {},
    levitate: { hover: "translate: 0 -7px;" },
    magnet: { hover: "scale: 1.12;", easing: SPRING },
    // The icon leans back in 3D, like a card lifted by its bottom edge.
    tilt: {
      hover: "rotate: x 18deg; translate: 0 -3px;",
      easing: SMOOTH,
      duration: 0.6,
      tile: "perspective: 420px;",
      origin: "50% 100%",
    },
    // The hovered icon stays sharp while the rest of the grid recedes.
    focus: {
      hover: "scale: 1.06;",
      easing: SMOOTH,
      duration: 0.5,
      group: "opacity: 0.4; scale: 0.94; filter: saturate(0.4);",
    },
    // Slow rise with a soft settle, closer to a breath than a jump.
    glide: { hover: "translate: 0 -5px; scale: 1.04;", easing: SMOOTH, duration: 0.9 },
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
    if (anims.length) {
      decl.push(`animation: ${anims.join(", ")};`);
    }
    const d = motion.duration || 0.3;
    const e = motion.easing || "ease";
    decl.push(`transition: translate ${d}s ${e}, scale ${d}s ${e}, rotate ${d}s ${e}, filter ${d}s ${e}, opacity ${d}s ${e}, box-shadow 0.3s ease;`);
    if (motion.origin) {
      decl.push(`transform-origin: ${motion.origin};`);
    }

    const neutral = !style.decl.length && !shape && !pad && !motion.hover && !p.iconIntro;
    if (neutral) {
      return "";
    }

    chunks.push(`${ICON} {\n  ${decl.join("\n  ")}\n}`);

    const hover = [];
    if (motion.hover) hover.push(motion.hover);
    if (style.hover) hover.push(style.hover);
    if (hover.length) {
      chunks.push(`${TILE}:hover .o_app_icon, ${TILE}:focus-visible .o_app_icon, ${TILE}.o_focused .o_app_icon {\n  ${hover.join("\n  ")}\n}`);
    }

    if (style.rules) chunks.push(style.rules);
    if (motion.tile) chunks.push(`${TILE} { ${motion.tile} }`);
    if (motion.group) {
      chunks.push(`${HOME} .o_apps:has(.o_app:hover) .o_app:not(:hover) .o_app_icon { ${motion.group} }`);
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


  const LABEL_FONTS = {
    default: "",
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    condensed: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif',
  };

  /**
   * Caption colour, size and font. Only what the user picked is written, so
   * "Auto" with the default size and font emits nothing at all.
   */
  globalThis.ostLabelCss = function (p) {
    const decl = [];
    if (p.labelColor === "white") {
      decl.push("color: #ffffff !important;", "text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);");
    } else if (p.labelColor === "black") {
      decl.push("color: #111111 !important;", "text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);");
    }
    if (p.labelSize) {
      decl.push(`font-size: ${p.labelSize}px !important;`);
    }
    if (LABEL_FONTS[p.labelFont]) {
      decl.push(`font-family: ${LABEL_FONTS[p.labelFont]} !important;`);
    }
    const chunks = [];
    if (decl.length) {
      chunks.push(`${CAPTION} { ${decl.join(" ")} }`);
    }
    if (p.labelColor !== "auto") {
      // The top bar sits on the same backdrop, so it follows the caption colour.
      chunks.push(`${BAR_ITEMS} { color: ${p.labelColor === "white" ? "#ffffff" : "#111111"} !important; }`);
    }
    return chunks.join("\n");
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
