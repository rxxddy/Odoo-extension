/**
 * Temi del drawer applicazioni.
 *
 * REGOLA ASSOLUTA: un tema tocca soltanto l'immagine `.o_app_icon`.
 * Mai `.o_app.o_menuitem`, mai la barra superiore. Dipingere il blocco intero
 * produce due cornici annidate, perche' le icone di Odoo sono gia' quadrati
 * con sfondo proprio.
 *
 * Lo sfondo di un `<img>` sta dietro all'immagine, che pero' e' opaca e copre
 * tutto il riquadro: per renderlo visibile si usa `box-sizing: border-box` piu'
 * `padding`, cosi' il disegno si rimpicciolisce e lo sfondo affiora come
 * cornice attorno. Nessuna regola altera l'ingombro, quindi la griglia resta
 * intatta.
 *
 * Il colore delle didascalie e della barra e' un controllo separato
 * (ostLabelCss), non fa parte dei temi.
 */
(function () {
  "use strict";

  const HOME = "body.o_home_menu_background";
  const ICON = `${HOME} .o_apps .o_app_icon`;
  const TILE = `${HOME} .o_apps .o_app.o_menuitem`;
  const CAPTION = `${HOME} .o_apps .o_app .o_caption`;

  const BAR_ITEMS = [
    `${HOME} .o_main_navbar`,
    `${HOME} .o_main_navbar button`,
    `${HOME} .o_main_navbar a`,
    `${HOME} .o_main_navbar i`,
    `${HOME} .o_main_navbar .oe_topbar_name`,
    `${HOME} .o_main_navbar .o_menu_toggle`,
  ].join(",\n");

  /** Cornice colorata attorno all'icona, senza modificarne l'ingombro. */
  function frame(css) {
    return `
      ${ICON} {
        box-sizing: border-box !important;
        padding: 5px !important;
        transition: background 0.15s ease, box-shadow 0.15s ease;
        ${css}
      }
    `;
  }

  const THEMES = {
    off: "",

    /* Vetro smerigliato: cornice traslucida, lo sfondo continua a passare. */
    glass:
      frame(`
        background: rgba(255, 255, 255, 0.16) !important;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.26),
                    0 6px 16px rgba(0, 0, 0, 0.28) !important;
        backdrop-filter: blur(12px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(12px) saturate(170%) !important;
      `) +
      `${TILE}:hover ${"" + ICON.split(" ").pop()} { background: rgba(255, 255, 255, 0.30) !important; }`,

    /* Notte: cornice scura, per sfondi chiari o molto contrastati. */
    midnight:
      frame(`
        background: rgba(12, 14, 20, 0.60) !important;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.10),
                    0 6px 16px rgba(0, 0, 0, 0.35) !important;
      `) +
      `${TILE}:hover ${ICON.split(" ").pop()} { background: rgba(12, 14, 20, 0.80) !important; }`,

    /* Giorno: cornice chiara, pensata per sfondi luminosi. */
    daylight:
      frame(`
        background: rgba(255, 255, 255, 0.62) !important;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08),
                    0 4px 12px rgba(0, 0, 0, 0.16) !important;
      `) +
      `${TILE}:hover ${ICON.split(" ").pop()} { background: rgba(255, 255, 255, 0.88) !important; }`,

    /*
     * Insegna RGB: un filo sottile in cui il gradiente corre lungo il
     * perimetro, invece di far cambiare colore a tutta la cornice insieme.
     *
     * Il trucco sono due sfondi sovrapposti: quello pieno si ferma al
     * `padding-box`, il conico arriva fino al `border-box` e resta visibile
     * solo nello spessore del bordo. Lo spessore dipende dal bordo e non dal
     * padding, quindi resta sottile anche riducendo l'icona.
     * L'angolo e' una proprieta' registrata: senza `@property` i gradienti non
     * sono animabili e l'anello resterebbe fermo.
     */
    rgb: `
      @property --ost-angle {
        syntax: "<angle>";
        initial-value: 0deg;
        inherits: false;
      }
      ${ICON} {
        box-sizing: border-box !important;
        padding: 3px !important;
        border: 2px solid transparent !important;
        background:
          linear-gradient(rgba(10, 12, 18, 0.55), rgba(10, 12, 18, 0.55)) padding-box,
          conic-gradient(
            from var(--ost-angle),
            #ff0040, #ff8a00, #ffee00, #22d36a,
            #00c2ff, #7a5cff, #ff00c8, #ff0040
          ) border-box !important;
        animation: ost-rgb-spin 4s linear infinite;
      }
      @keyframes ost-rgb-spin {
        to { --ost-angle: 360deg; }
      }
      @media (prefers-reduced-motion: reduce) {
        ${ICON} { animation: none !important; }
      }
    `,

    /* Aurora: cornice sfumata sui colori di Odoo, aubergine verso teal. */
    aurora: frame(`
      background: linear-gradient(135deg, #714b67, #017e84) !important;
      box-shadow: 0 6px 18px rgba(1, 126, 132, 0.35) !important;
    `),

    /* Contorno: solo un filo di luce, nessuna superficie. */
    outline: `
      ${ICON} {
        background: transparent !important;
        box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.55) !important;
        transition: box-shadow 0.15s ease;
      }
      ${TILE}:hover ${ICON.split(" ").pop()} {
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95) !important;
      }
    `,

    /* Rilievo: nessuna cornice, l'icona si stacca dallo sfondo con l'ombra. */
    lifted: `
      ${ICON} {
        background: transparent !important;
        filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55));
        transition: filter 0.15s ease, transform 0.15s ease;
      }
      ${TILE}:hover ${ICON.split(" ").pop()} {
        filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.65));
        transform: translateY(-3px);
      }
    `,

    /* Grigio: icone desaturate che riprendono colore al passaggio del mouse. */
    greyscale: `
      ${ICON} {
        background: transparent !important;
        filter: grayscale(1) contrast(0.95) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
        transition: filter 0.2s ease;
      }
      ${TILE}:hover ${ICON.split(" ").pop()} {
        filter: grayscale(0) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.40));
      }
    `,

    /* Carta: cornice avorio opaca con ombra morbida, aria da documento. */
    paper: frame(`
      background: #f4f1ea !important;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06),
                  0 3px 10px rgba(0, 0, 0, 0.22) !important;
    `),
  };


  /**
   * Targhetta dell'ambiente. Non e' vincolata al menu principale: serve
   * ovunque, perche' il suo scopo e' impedire di modificare il database
   * sbagliato mentre si lavora dentro a un'applicazione.
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

  globalThis.ostThemeCss = function (name) {
    return THEMES[name] || "";
  };

  /**
   * Colore di didascalie e barra superiore. Controllo separato dai temi: su una
   * foto scura il testo nero di Odoo sparisce, ed e' un problema di leggibilita'
   * indipendente dallo stile scelto per le icone.
   */
  const LABELS = {
    auto: "",
    light: `
      ${CAPTION} {
        color: #ffffff !important;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
      }
      ${BAR_ITEMS} {
        color: #ffffff !important;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
      }
    `,
    dark: `
      ${CAPTION} {
        color: #1b1e29 !important;
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.55);
      }
      ${BAR_ITEMS} { color: #1b1e29 !important; }
    `,
  };

  globalThis.ostLabelCss = function (mode) {
    return LABELS[mode] || "";
  };

  /**
   * Dimensione del disegno dentro l'icona.
   *
   * Agisce solo sul `padding`: il riquadro dell'elemento, e quindi lo sfondo
   * disegnato dal tema, non cambia mai misura. Si rimpicciolisce soltanto
   * l'immagine al suo interno. I valori sono in pixel e non in percentuale
   * perche' un padding percentuale si calcola sulla larghezza del contenitore,
   * non su quella dell'icona, e produrrebbe rientri enormi.
   */
  const ICON_PADDING = { m: "14px", s: "22px" };

  globalThis.ostIconSizeCss = function (size) {
    const pad = ICON_PADDING[size];
    if (!pad) {
      return "";
    }
    return `
      ${ICON} {
        box-sizing: border-box !important;
        padding: ${pad} !important;
      }
    `;
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
   * deve funzionare con qualunque tema. Si usa `transform` e non `width` perche'
   * non altera il flusso, quindi la griglia non si scompone qualunque sia la
   * dimensione base decisa da Odoo.
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
