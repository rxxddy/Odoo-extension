# UI Enhancer for Odoo

A Chrome extension that restyles the Odoo.sh app drawer, tweaks a handful of
developer-facing rough edges, and adds a few conveniences for the Odoo.sh
online editor — all opt-in, domain by domain.

**Author:** Weden — [wedendev@gmail.com](mailto:wedendev@gmail.com)
**License:** proprietary, personal use only — see [`LICENSE.md`](./LICENSE.md).
This is not open source: no permission is granted to copy, modify, or
redistribute this extension or its source without the author's written
consent.

---

## Everything is off by default

This matters enough to say first: **a fresh install changes nothing.** The
master switch in the header defaults to off, and every individual toggle
underneath it defaults to off too — including the icon background/border/
effect pickers, which default to "None" on all three, meaning Odoo's app
icons render exactly as Odoo ships them.

Opening a brand-new Odoo project for the first time should look identical to
not having the extension installed at all. Nothing is applied until you open
the popup and turn something on yourself, one domain at a time.

The header switch is also the fastest way back to a stock Odoo look at any
time: turning it off removes every style, wallpaper layer, badge, and
restored banner the extension had added, on that tab, immediately.

---

## Appearance

Everything here is remembered **per domain** — each Odoo project can look
different, and a domain you've never customized always falls back to Odoo's
own design.

### App icons

A three-part builder, each part independent so they combine freely (e.g. an
animated RGB border on a fully transparent background):

- **Background** — 14 options: solid fills (dark, black, light, white,
  paper, Odoo's own aubergine/teal), frosted glass, and four gradients
  (aurora, sunset, ocean, nightfall).
- **Border** — 9 options: hairline (light/dark), thick, double ring, teal
  glow, white halo, ember glow, or an animated RGB ring that cycles through
  the colour wheel.
- **Effect** — 12 options, from static (soft shadow, greyscale, inverted,
  teal colour wash) to hover-triggered (pop, bounce, wiggle, spin, lifted) to
  continuously animated (breathing glow, flash).
- A live preview updates as you pick, using the exact same styling code the
  real app drawer gets — no separate "preview-only" approximation.
- **Artwork size** (Large/Medium/Small) shrinks the icon's artwork without
  changing the frame around it, so a smaller icon still fits a chosen
  background/border cleanly.
- **Corners**: an on/off toggle plus a radius slider, off by default.
- **Label theme**: Auto (Odoo's own colours), Light, or Dark — recolours the
  app names and the top bar to stay legible over a wallpaper.
- **Hide app names**: drops the text labels and enlarges the icons.

### Wallpaper

Three ways to add a wallpaper, always available together:

- **Link** — paste a direct image URL.
- **Upload** — pick any photo or video file; the extension detects which one
  it is automatically. Supported: PNG/JPEG/WebP/GIF for images, MP4/WebM/Ogg
  for video (AVI and similar are rejected — most browsers can't decode them
  anyway, so accepting them would only look broken).
- **Folder** — link a local folder once (via the browser's file-system
  picker); its images and videos are read and cached, so they're available
  as wallpapers on every Odoo project afterwards without asking for the
  folder again. A sync button re-scans it for new files.

A compact gallery shows your 4 most recent wallpapers plus a link to the full
library. Each thumbnail carries a small badge showing where it came from
(link / upload / folder) and, for videos, a second badge — folder videos get
a real first-frame thumbnail, uploaded videos get a plain placeholder.
Folder-sourced images can't be deleted from here (the file itself still
lives on your disk); everything else can be.

**Solid colour or gradient** is a fourth option living in its own collapsible
box: pick one or two colours and, for a gradient, an angle. A **logo** can be
layered on top of it — upload one, then position and size it with sliders;
it disappears automatically (not deleted, just hidden) the moment you switch
to a photo or video wallpaper, and reappears if you switch back.

**Darken** and **Blur** sliders apply to whichever wallpaper type is active
(blur has no visible effect on a flat colour/gradient, so it's skipped
there).

---

## Developer

### On-page noise

- Hide the Odoo.sh trial/staging "this database will be deleted" banner.
- Hide the red "database neutralized for testing" banner.

### Tools

- **Developer mode** — reloads the page once with `?debug=1` if it isn't on
  already.
- **Copy field names on click** — click a field's label anywhere in Odoo
  (list headers included) to copy its technical name, e.g. `x_studio_note`.
  Requires developer mode, since that's what makes Odoo expose the name in
  the first place.
- **Shell interface tweaks**, for the Odoo.sh online editor specifically:
  - adds an `odoo-bin shell` item to the editor's menu bar, next to Help —
    clicking it opens a terminal (creating one if needed) and runs the
    command;
  - adds **Zip folder** and **Update module** to the file browser's
    right-click menu, only when right-clicking a folder — they run
    `zip -r <name>.zip <name>` and `odoo-bin -u <name> --st` with the
    folder's own name substituted in.

### Environment badge

A small on-page label reading PROD, STAGING, or DEV, so you can't
mistake which database you're in. Detected automatically: STAGING/PROD from
the hostname pattern, DEV from the page's own "temporary development
environment" banner. Configurable corner, text size, and colour (automatic
per environment, or a custom colour of your own); can be excluded per domain
— only on Odoo project subdomains, so it can't quietly collect a list of
unrelated sites.

---

## Working outside odoo.com/odoo.sh

The extension normally only runs on `*.odoo.com` and `*.odoo.sh`. If you open
it on something else — a local Odoo instance during development, say — a
card in the Appearance tab offers to enable it there too. Accepting asks the
browser for permission on that one address only (never a blanket "all
websites" grant) and remembers the choice, so it's active there again on the
next visit without asking twice.

## Toolbar icon

The toolbar icon itself switches between two states so you can tell at a
glance whether the extension is doing anything on the page you're looking
at: one icon when it's active there, a different one when it isn't (master
switch off, or a domain that hasn't been enabled).

## PRO and the beta

The first time you open the popup, a welcome message explains that, as a
beta tester, you've been given a complimentary PRO subscription for as long
as the beta lasts, with at least 30 days' notice before that ever changes.
Settings that are part of PRO turn on with a distinct colour instead of the
usual one, so they're easy to spot. The message itself is reachable again
any time via the **PRO** chip in the header.

## Language

The popup's interface is available in English, Italian, German, French,
Spanish, Dutch, and Portuguese, switchable from a flag dropdown next to the
Developer tab. English is the default and the fallback: any string not yet
translated in another language simply shows in English rather than leaving a
gap. The extension's own name and description (shown in `chrome://extensions`
and the Chrome Web Store listing) are localized separately, following
Chrome's own `_locales` mechanism, matched to your browser's language.

---

## Privacy

Everything the extension stores — settings, per-domain appearance, wallpaper
images, the folder cache — stays in the browser's local extension storage
(`chrome.storage.local` and, for the folder cache, IndexedDB). None of it is
sent anywhere. The only network requests the extension itself makes are the
ones inherent to loading a wallpaper image you've linked to, and the Discord
link in the footer, which you open yourself.

## Support

Bug reports, questions, or anything else: join the Discord link in the
extension's footer, or write to
[wedendev@gmail.com](mailto:wedendev@gmail.com).
