/**
 * Backdrop tab: animated effects, colour or gradient, a photo, or a video.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, card, row, toggle, segmented, sliderField, colorInput, textInput, button, filePicker, note, svg } = ns.ui;
  const media = ns.media;

  const GRADIENTS = [
    ["#0f2027", "#2c7a7b"], ["#41295a", "#2f0743"], ["#0b3d91", "#00c2ff"], ["#141e30", "#243b55"],
    ["#ff3d6e", "#7c1f6b"], ["#134e2a", "#00ff9c"], ["#232526", "#414345"], ["#07080d", "#07080d"],
  ];

  const ICON = {
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', 14),
    folder: svg('<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>', 14),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>', 12),
  };

  // Keyframes for the animated thumbnails, added once.
  document.head.append(h("style", null, globalThis.OST_FX_KEYFRAMES));

  let message = { text: "", kind: "" };
  const say = (text, kind = "") => {
    message = { text, kind };
    actions.notify();
  };

  const ERRORS = { read: "wp.err.read", big: "wp.err.big", format: "wp.err.format", url: "wp.err.url", unsupported: "wp.err.folder" };

  async function handleFiles(files) {
    say(t("wp.working"));
    for (const file of files) {
      const code = await media.importWallpaperFile(file);
      if (code) {
        say(t(ERRORS[code], { mb: Math.round(globalThis.OST_MAX_VIDEO_BYTES / 1048576) }), "warn");
        return;
      }
    }
    say("");
  }

  async function handleFolder() {
    const code = await media.linkFolder(() => say(t("wp.working")));
    if (code === "cancelled") return;
    say(code ? t(ERRORS[code] || "wp.err.read") : "", code ? "warn" : "");
  }

  function swatch(colors, active, onPick) {
    const b = h("button", { type: "button", class: "swatch" + (active ? " on" : ""), onclick: onPick, "aria-label": colors.join(" ") });
    b.style.background = colors[0] === colors[1] ? colors[0] : `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
    return b;
  }

  function palette(list) {
    const p = store.profile;
    return h(
      "div",
      { class: "swatches" },
      list.map((c) =>
        swatch(c, p.wallpaperColor1 === c[0] && p.wallpaperColor2 === c[1], () =>
          actions.setProfile({ wallpaperColor1: c[0], wallpaperColor2: c[1], wallpaperGradient: c[0] !== c[1], wallpaperEnabled: true })
        )
      )
    );
  }

  function colorPair() {
    const p = store.profile;
    return row(
      t("wp.colors"),
      null,
      h(
        "div",
        { class: "pair" },
        colorInput(p.wallpaperColor1, (v) => actions.quiet("profile", { wallpaperColor1: v }), "A"),
        colorInput(p.wallpaperColor2, (v) => actions.quiet("profile", { wallpaperColor2: v }), "B")
      )
    );
  }

  function fxSection() {
    const p = store.profile;
    return card(
      t("wp.fx"),
      h(
        "div",
        { class: "grid-4" },
        globalThis.OST_WALLPAPER_FX.map((fx) => {
          const art = h("span", { class: "pick-art" });
          art.style.cssText = globalThis.ostFxBackground(fx, p.wallpaperColor1, p.wallpaperColor2);
          return h(
            "button",
            {
              type: "button",
              class: "pick" + (p.wallpaperFx === fx ? " on" : ""),
              onclick: () => actions.setProfile({ wallpaperFx: fx, wallpaperEnabled: true }),
            },
            art,
            t("fx." + fx)
          );
        })
      ),
      palette(globalThis.OST_ACCENTS),
      colorPair()
    );
  }

  function colorSection() {
    const p = store.profile;
    return card(
      t("wp.kind.color"),
      palette(GRADIENTS),
      colorPair(),
      row(t("wp.gradient"), null, toggle(p.wallpaperGradient, (v) => actions.setProfile({ wallpaperGradient: v }))),
      p.wallpaperGradient
        ? sliderField(t("wp.angle"), {
            min: 0, max: 360, step: 5, value: p.wallpaperAngle, format: (v) => v + "°",
            onInput: (v) => actions.quiet("profile", { wallpaperAngle: v }),
          })
        : null
    );
  }

  function isActive(entry, kind) {
    const p = store.profile;
    if (kind === "video") {
      return p.videoSource !== "url" && entry.name === store.media.videoName;
    }
    return entry.source === "url" ? p.imageSource === "url" && p.imageUrl === entry.url : p.imageSource !== "url" && p.imageName === entry.name;
  }

  /**
   * Thumbnail as a real element, not a CSS background, so a missing or broken
   * thumbnail can fall back to the media itself instead of a grey square.
   */
  function tileArt(entry, kind) {
    const source = entry.data || entry.url || "";
    if (kind === "video" && !entry.thumb && source) {
      return h("video", { class: "tile-art", src: source + "#t=1", muted: true, preload: "metadata", playsInline: true });
    }
    const img = h("img", { class: "tile-art", src: entry.thumb || source, alt: "", loading: "lazy" });
    img.addEventListener("error", () => {
      if (kind === "image" && source && img.src !== source) img.src = source;
      else img.remove();
    });
    return img;
  }

  function tile(entry, kind, onPick, onRemove) {
    const el = h("button", { type: "button", class: "tile" + (isActive(entry, kind) ? " on" : ""), title: entry.name, onclick: onPick });
    el.append(tileArt(entry, kind));
    el.append(h("span", { class: "tile-name" }, entry.name));
    if (kind === "video") {
      el.append(h("span", { class: "tile-kind" }, "▶"));
    }
    if (onRemove) {
      el.append(
        h("span", { class: "tile-x", role: "button", "aria-label": t("common.remove"), onclick: (e) => { e.stopPropagation(); onRemove(); } }, ICON.trash.cloneNode(true))
      );
    }
    return el;
  }

  function gallery(kind) {
    const tiles = [];
    if (kind === "image") {
      for (const e of store.library.slice().sort((a, b) => b.usedAt - a.usedAt)) {
        tiles.push(tile(e, "image", () => media.applyImage(e), () => media.removeFromLibrary(e)));
      }
    }
    if (kind === "video" && store.profile.videoSource === "file" && store.media.videoName) {
      tiles.push(tile({ name: store.media.videoName, thumb: store.media.videoThumb, data: store.media.videoData }, "video", () => {}, null));
    }
    for (const e of media.folder.entries.filter((x) => x.kind === kind)) {
      tiles.push(
        tile(e, kind, () => (kind === "image" ? media.applyImage({ source: "folder", data: e.data, name: e.name, size: e.size }) : media.applyVideo({ source: "folder", data: e.data, name: e.name, thumb: e.thumb })), null)
      );
    }
    return tiles.length ? h("div", { class: "grid-4" }, tiles) : note(t("wp.empty"), "muted");
  }

  function mediaSection(kind) {
    const isImage = kind === "image";
    return card(
      t(isImage ? "wp.kind.image" : "wp.kind.video"),
      textInput({
        placeholder: t(isImage ? "wp.linkImage" : "wp.linkVideo"),
        button: t("common.add"),
        onSubmit: (value) => {
          const code = isImage ? media.importImageUrl(value) : media.importVideoUrl(value);
          say(code ? t(ERRORS[code]) : "", code ? "warn" : "");
        },
      }),
      h(
        "div",
        { class: "btn-row fill" },
        filePicker(t("wp.upload"), { accept: "image/*,video/mp4,video/webm,video/ogg", onFiles: handleFiles, icon: ICON.upload }),
        button(media.folder.linked ? t("wp.folderSync", { name: media.folder.name }) : t("wp.folderLink"), handleFolder, { icon: ICON.folder }),
        media.folder.linked ? button(t("wp.folderUnlink"), () => media.unlinkFolder(), { kind: "ghost" }) : null
      ),
      message.text ? note(message.text, message.kind) : null,
      gallery(kind)
    );
  }

  function render() {
    const p = store.profile;
    const kind = p.wallpaperKind;
    const body = { fx: fxSection, color: colorSection }[kind];
    return h(
      "div",
      { class: "panel" },
      card(
        [t("wp.title"), toggle(p.wallpaperEnabled, (v) => actions.setProfile({ wallpaperEnabled: v }), t("wp.title"))],
        segmented(
          globalThis.OST_WALLPAPER_KINDS.map((k) => ({ value: k, label: t("wp.kind." + k) })),
          kind,
          (v) => actions.setProfile({ wallpaperKind: v })
        ),
        note(t("wp.hint"), "muted")
      ),
      body ? body() : mediaSection(kind),
      card(
        t("wp.adjust"),
        sliderField(t("wp.dim"), { min: 0, max: 0.9, step: 0.05, value: p.wallpaperDim, format: (v) => Math.round(v * 100) + "%", onInput: (v) => actions.quiet("profile", { wallpaperDim: v }) }),
        kind === "image" || kind === "video"
          ? sliderField(t("wp.blur"), { min: 0, max: 24, value: p.wallpaperBlur, format: (v) => v + "px", onInput: (v) => actions.quiet("profile", { wallpaperBlur: v }) })
          : null
      )
    );
  }

  ns.panels = ns.panels || {};
  ns.panels.wallpaper = render;
})(globalThis.OstPopup);
