/**
 * Aspetto delle icone del drawer applicazioni.
 *
 * REGOLA ASSOLUTA: si tocca soltanto l'immagine `.o_app_icon`.
 * Mai `.o_app.o_menuitem`, mai la barra superiore. Dipingere il blocco intero
 * produce due cornici annidate, perche' le icone di Odoo sono gia' quadrati
 * con sfondo proprio.
 *
 * L'aspetto non e' piu' un "tema" monolitico ma tre scelte indipendenti che si
 * combinano liberamente: sfondo, bordo ed effetto. Cosi' si puo' avere, ad
 * esempio, il bordo RGB animato su uno sfondo nero o trasparente — cosa
 * impossibile finche' ogni tema era un blocco di CSS chiuso.
 *
 * Lo sfondo di un `<img>` sta dietro all'immagine, che pero' e' opaca e copre
 * tutto il riquadro: per renderlo visibile si usa `box-sizing: border-box` piu'
 * `padding`, cosi' il disegno si rimpicciolisce e lo sfondo affiora come
 * cornice attorno. Nessuna regola altera l'ingombro dell'elemento, quindi la
 * griglia di Odoo resta intatta.
 */
(function () {
  "use strict";

  const HOME = "body.o_home_menu_background";
  const ICON = `${HOME} .o_apps .o_app_icon`;
  const TILE = `${HOME} .o_apps .o_app.o_menuitem`;
  const CAPTION = `${HOME} .o_apps .o_app .o_caption`;
  // Selettore breve dell'icona, per le regole di hover annidate sotto al tile.
  const ICON_LEAF = ".o_app_icon";

  const BAR_ITEMS = [
    `${HOME} .o_main_navbar`,
    `${HOME} .o_main_navbar button`,
    `${HOME} .o_main_navbar a`,
    `${HOME} .o_main_navbar i`,
    `${HOME} .o_main_navbar .oe_topbar_name`,
    `${HOME} .o_main_navbar .o_menu_toggle`,
  ].join(",\n");

  // ------------------------------------------------------------------
  // Ingredienti componibili
  // ------------------------------------------------------------------

  /*
   * Separazione netta, come deve essere:
   *   - lo SFONDO usa solo `background-color` o `background-image`;
   *   - il BORDO usa solo `box-shadow`, mai un livello di sfondo;
   *   - l'EFFETTO usa solo `filter` e le proprieta' indipendenti
   *     `scale` / `translate`.
   *
   * Il bordo RGB in precedenza era un gradiente conico disegnato come livello
   * di sfondo esteso al border-box. Con uno sfondo traslucido (il vetro) quel
   * gradiente traspariva al centro e sporcava tutta l'icona. Un livello di
   * sfondo non puo' essere limitato al solo anello, quindi il bordo animato e'
   * ora un `box-shadow` che percorre la ruota dei colori: resta un anello e
   * nient'altro, e si combina con qualunque sfondo, trasparenza inclusa.
   *
   * `scale` e `translate` sono proprieta' a se' stanti e non `transform`:
   * l'interruttore "nascondi i nomi" usa gia' `transform: scale()` sulle icone
   * e le due cose si annullerebbero a vicenda.
   */

  const BACKGROUNDS = {
    none: { label: "None", color: "transparent", framed: false },
    glass: {
      label: "Frosted glass",
      color: "rgba(255, 255, 255, 0.16)",
      framed: true,
      extra: `
        backdrop-filter: blur(12px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(12px) saturate(170%) !important;
      `,
      hover: "rgba(255, 255, 255, 0.30)",
    },
    smoke: {
      label: "Smoked glass",
      color: "rgba(12, 14, 20, 0.34)",
      framed: true,
      extra: `
        backdrop-filter: blur(14px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
      `,
      hover: "rgba(12, 14, 20, 0.52)",
    },
    dark: { label: "Dark", color: "rgba(12, 14, 20, 0.60)", framed: true, hover: "rgba(12, 14, 20, 0.80)" },
    black: { label: "Solid black", color: "#0b0d12", framed: true },
    light: { label: "Light", color: "rgba(255, 255, 255, 0.62)", framed: true, hover: "rgba(255, 255, 255, 0.88)" },
    white: { label: "Solid white", color: "#ffffff", framed: true },
    paper: { label: "Paper", color: "#f4f1ea", framed: true },
    aubergine: { label: "Odoo aubergine", color: "#714b67", framed: true },
    teal: { label: "Odoo teal", color: "#017e84", framed: true },
    aurora: { label: "Aurora", layer: "linear-gradient(135deg, #714b67, #017e84)", framed: true },
    sunset: { label: "Sunset", layer: "linear-gradient(140deg, #f0863c, #d0442c 55%, #8e3d7a)", framed: true },
    ocean: { label: "Ocean", layer: "linear-gradient(140deg, #2f6fb0, #017e84)", framed: true },
    nightfall: { label: "Nightfall", layer: "linear-gradient(160deg, #2b3350, #0b0d12)", framed: true },
  };

  const BORDERS = {
    none: { label: "None" },
    hairline: {
      label: "Hairline light",
      ring: "0 0 0 1.5px rgba(255, 255, 255, 0.55)",
      hoverRing: "0 0 0 2px rgba(255, 255, 255, 0.95)",
    },
    dark: {
      label: "Hairline dark",
      ring: "0 0 0 1.5px rgba(12, 14, 20, 0.55)",
      hoverRing: "0 0 0 2px rgba(12, 14, 20, 0.8)",
    },
    thick: {
      label: "Thick white",
      ring: "0 0 0 3px rgba(255, 255, 255, 0.9)",
      hoverRing: "0 0 0 3px #ffffff",
    },
    double: {
      label: "Double ring",
      ring: "0 0 0 1.5px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(255, 255, 255, 0.25)",
    },
    glow: {
      label: "Teal glow",
      ring: "0 0 0 1.5px rgba(79, 179, 184, 0.75), 0 0 14px rgba(79, 179, 184, 0.5)",
      hoverRing: "0 0 0 1.5px rgba(120, 240, 245, 0.95), 0 0 22px rgba(79, 179, 184, 0.75)",
    },
    halo: {
      label: "White halo",
      ring: "0 0 0 1px rgba(255, 255, 255, 0.7), 0 0 16px rgba(255, 255, 255, 0.45)",
    },
    ember: {
      label: "Ember glow",
      ring: "0 0 0 1.5px rgba(240, 134, 60, 0.8), 0 0 16px rgba(208, 68, 44, 0.55)",
    },
    rgb: {
      label: "RGB (animated)",
      animated: true,
      // Valore di partenza, poi animato dai keyframes. Volutamente SENZA
      // !important: vedi la nota nella composizione qui sotto.
      ring: "0 0 0 2px #ff0040, 0 0 12px rgba(255, 0, 64, 0.55)",
    },
  };

  /*
   * Ogni effetto usa solo `filter` e le proprieta' indipendenti
   * `scale`/`rotate`/`translate` (mai `background`, mai pseudo-elementi):
   * l'icona e' un `<img>`, e gli pseudo-elementi su elementi sostituiti sono
   * un terreno incerto tra i motori di rendering, mentre filter/scale/rotate
   * sono garantiti. Le proprieta' indipendenti (non `transform`) servono a
   * non annullare lo `scale()` che l'interruttore "Hide app names" applica
   * gia' alle icone altrove.
   */
  const EFFECTS = {
    none: { label: "None" },

    shadow: { label: "Soft shadow", filter: "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4))" },

    lifted: {
      label: "Lifted",
      filter: "drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55))",
      hoverFilter: "drop-shadow(0 14px 26px rgba(0, 0, 0, 0.65))",
      hoverExtra: "translate: 0 -4px;",
    },

    pop: { label: "Pop on hover", hoverExtra: "scale: 1.12;" },

    bounce: {
      label: "Bounce on hover",
      hoverAnimation: "ost-fx-bounce 0.55s cubic-bezier(.36,1.7,.4,1)",
      keyframes: `
        @keyframes ost-fx-bounce {
          0%   { scale: 1 1; }
          30%  { scale: 1.22 0.85; }
          55%  { scale: 0.92 1.08; }
          75%  { scale: 1.05 0.97; }
          100% { scale: 1 1; }
        }
      `,
    },

    wiggle: {
      label: "Wiggle on hover",
      hoverAnimation: "ost-fx-wiggle 0.5s ease-in-out",
      keyframes: `
        @keyframes ost-fx-wiggle {
          0%, 100% { rotate: 0deg; }
          20%  { rotate: -9deg; }
          40%  { rotate: 8deg; }
          60%  { rotate: -6deg; }
          80%  { rotate: 3deg; }
        }
      `,
    },

    spin: {
      label: "Spin on hover",
      hoverAnimation: "ost-fx-spin 0.6s ease-in-out",
      keyframes: `@keyframes ost-fx-spin { from { rotate: 0deg; } to { rotate: 360deg; } }`,
    },

    greyscale: {
      label: "Greyscale, colour on hover",
      filter: "grayscale(1) contrast(0.95)",
      hoverFilter: "grayscale(0)",
    },

    invert: { label: "Inverted colours", filter: "invert(1) hue-rotate(180deg)" },

    tint: {
      label: "Teal wash",
      // Nessun overlay: si desatura e si reintroduce colore con hue-rotate,
      // lo stesso trucco delle vecchie foto virate seppia, spostato verso il
      // teal del marchio invece dell'arancio. Funziona con il solo filter,
      // niente livelli aggiuntivi da comporre con lo sfondo.
      filter: "grayscale(0.6) sepia(1) saturate(4) hue-rotate(150deg) brightness(0.95)",
      hoverFilter: "grayscale(0) sepia(0) saturate(1) hue-rotate(0deg) brightness(1)",
    },

    glow: {
      label: "Breathing glow",
      animation: "ost-fx-glow 2.6s ease-in-out infinite",
      keyframes: `
        @keyframes ost-fx-glow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(79, 179, 184, 0.35)); }
          50%      { filter: drop-shadow(0 0 11px rgba(79, 179, 184, 0.9)); }
        }
      `,
    },

    flash: {
      label: "Flash",
      animation: "ost-fx-flash 2.4s ease-in-out infinite",
      keyframes: `
        @keyframes ost-fx-flash {
          0%, 80%, 100% { filter: brightness(1); }
          90%            { filter: brightness(1.45); }
        }
      `,
    },
  };

  globalThis.OST_ICON_BACKGROUNDS = BACKGROUNDS;
  globalThis.OST_ICON_BORDERS = BORDERS;
  globalThis.OST_ICON_EFFECTS = EFFECTS;

  const BLANK_PIXEL =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  // Rientro aggiuntivo per le misure ridotte, sommato alla cornice di base.
  const SIZE_EXTRA = { l: 0, m: 7, s: 14 };

  // ------------------------------------------------------------------
  // Composizione
  // ------------------------------------------------------------------

  /**
   * Costruisce il CSS delle icone a partire dal profilo.
   *
   * Sta tutto in una funzione perche' sfondo, misura e disegno finiscono nelle
   * stesse proprieta' (`background-image`, `background-clip`, `padding`):
   * generarli da regole separate significherebbe farli sovrascrivere a vicenda.
   */
  globalThis.ostIconCss = function (profile) {
    const bg = BACKGROUNDS[profile.iconBackground] || BACKGROUNDS.none;
    const bd = BORDERS[profile.iconBorder] || BORDERS.none;
    const fx = EFFECTS[profile.iconEffect] || EFFECTS.none;

    // Il disegno passa su un livello di sfondo solo quando va rimpicciolito:
    // e' l'unico modo per non farlo ritagliare dalla curva del content box.
    const artMode = profile.iconSize !== "l";
    const basePad = bg.framed ? 5 : 0;
    const pad = basePad + (SIZE_EXTRA[profile.iconSize] || 0);

    const images = [];
    const origins = [];
    const clips = [];
    const sizes = [];

    if (artMode) {
      images.push("var(--ost-art)");
      origins.push("content-box");
      clips.push("border-box");
      sizes.push("contain");
    }
    if (bg.layer) {
      images.push(bg.layer);
      origins.push("border-box");
      clips.push("border-box");
      sizes.push("auto");
    }

    const decl = [
      "box-sizing: border-box !important;",
      `padding: ${pad}px !important;`,
      // Nessun bordo CSS: l'anello e' sempre e solo un box-shadow, quindi non
      // puo' in alcun caso dipingere dietro all'icona.
      "border: 0 !important;",
    ];

    if (images.length) {
      decl.push(`background-image: ${images.join(", ")} !important;`);
      decl.push(`background-origin: ${origins.join(", ")} !important;`);
      decl.push(`background-clip: ${clips.join(", ")} !important;`);
      decl.push(`background-size: ${sizes.join(", ")} !important;`);
      decl.push("background-repeat: no-repeat !important;");
      decl.push("background-position: center !important;");
    } else {
      decl.push("background-image: none !important;");
    }
    decl.push(`background-color: ${bg.layer ? "transparent" : bg.color} !important;`);

    // Il `!important` va messo su tutti i bordi TRANNE quello animato.
    // Le dichiarazioni !important dentro a @keyframes vengono ignorate per
    // specifica, quindi un valore di base !important vincerebbe sempre
    // sull'animazione e l'anello resterebbe fermo o invisibile. E' esattamente
    // il motivo per cui l'anello RGB era sparito del tutto.
    decl.push(`box-shadow: ${bd.ring || "none"}${bd.animated ? ";" : " !important;"}`);
    // Stessa cosa per gli effetti che animano il filtro (Glow, Flash): se la
    // base restasse "filter: none !important" l'animazione non riuscirebbe
    // mai a scavalcarla.
    const animatesFilter = !!(fx.animation || fx.hoverAnimation);
    decl.push(`filter: ${fx.filter || "none"}${animatesFilter ? ";" : " !important;"}`);
    if (fx.animation) {
      decl.push(`animation: ${fx.animation};`);
    }
    if (bg.extra) {
      decl.push(bg.extra.trim());
    }
    decl.push(
      "transition: background-color 0.15s ease, box-shadow 0.15s ease," +
        " filter 0.2s ease, scale 0.15s ease, translate 0.15s ease;"
    );

    const selector = artMode ? `${ICON}.ost-art` : ICON;
    const chunks = [];

    if (artMode) {
      chunks.push(`${selector} { content: url("${BLANK_PIXEL}") !important; }`);
    }
    chunks.push(`${selector} {\n  ${decl.join("\n  ")}\n}`);

    // --- Stati al passaggio del mouse -------------------------------------
    const hoverDecl = [];
    // `background-color`, mai lo shorthand `background`: quest'ultimo azzera
    // anche `background-image`, dove vive il disegno in modalita' ridotta.
    if (bg.hover && !bg.layer) {
      hoverDecl.push(`background-color: ${bg.hover} !important;`);
    }
    if (bd.hoverRing) {
      hoverDecl.push(`box-shadow: ${bd.hoverRing} !important;`);
    }
    if (fx.hoverFilter) {
      hoverDecl.push(`filter: ${fx.hoverFilter} !important;`);
    }
    if (fx.hoverExtra) {
      hoverDecl.push(fx.hoverExtra);
    }
    if (fx.hoverAnimation) {
      hoverDecl.push(`animation: ${fx.hoverAnimation};`);
    }
    if (hoverDecl.length) {
      chunks.push(
        `${TILE}:hover ${ICON_LEAF}, ${TILE}:focus-visible ${ICON_LEAF} {\n  ${hoverDecl.join("\n  ")}\n}`
      );
    }

    // --- Keyframes dell'effetto scelto -------------------------------------
    // Emessi solo quando servono: nessun costo per gli altri profili.
    if (fx.keyframes) {
      chunks.push(fx.keyframes);
      chunks.push(`
        @media (prefers-reduced-motion: reduce) {
          ${selector} { animation: none !important; }
          ${TILE}:hover ${ICON_LEAF}, ${TILE}:focus-visible ${ICON_LEAF} { animation: none !important; }
        }
      `);
    }

    // --- Anello RGB animato ------------------------------------------------
    if (bd.animated) {
      const stops = [
        [0, "#ff0040"], [14, "#ff8a00"], [28, "#ffee00"], [42, "#22d36a"],
        [57, "#00c2ff"], [71, "#4b5cff"], [85, "#c840ff"], [100, "#ff0040"],
      ];
      // Nessun !important nei keyframes: verrebbe ignorato dal browser.
      const frames = stops
        .map(([pct, c]) => `          ${pct}% { box-shadow: 0 0 0 2px ${c}, 0 0 12px ${c}88; }`)
        .join("\n");
      chunks.push(`
        ${selector} { animation: ost-rgb-ring 5s linear infinite; }
        @keyframes ost-rgb-ring {
${frames}
        }
        @media (prefers-reduced-motion: reduce) {
          ${selector} { animation: none; }
        }
      `);
    }

    return chunks.join("\n");
  };

  // ------------------------------------------------------------------
  // Targhetta ambiente
  // ------------------------------------------------------------------

  /**
   * Non e' vincolata al menu principale: serve ovunque, perche' il suo scopo e'
   * impedire di modificare il database sbagliato mentre si lavora dentro a
   * un'applicazione.
   */
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

  // ------------------------------------------------------------------
  // Didascalie e barra superiore
  // ------------------------------------------------------------------

  /**
   * Controllo separato dalle icone: su una foto scura il testo scuro di Odoo
   * sparisce, ed e' un problema di leggibilita' che non dipende dallo stile
   * scelto per le icone.
   *
   * Il tema scuro forza anche `font-size` e `font-weight`: senza, Odoo in certe
   * viste applica una propria regola piu' specifica e la didascalia usciva
   * minuscola e di un colore diverso da quello impostato qui.
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
   * Messaggio di conferma della copia. In basso a sinistra, fuori dal flusso e
   * senza intercettare i click, per non coprire nulla di utilizzabile.
   */
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
   * Nasconde le didascalie e ingrandisce le icone. Interruttore indipendente:
   * deve funzionare con qualunque combinazione. Si usa `transform` e non
   * `width` perche' non altera il flusso, quindi la griglia non si scompone
   * qualunque sia la dimensione base decisa da Odoo.
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
