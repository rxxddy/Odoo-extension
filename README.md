# UI Enhancer for Odoo

Chrome Extension (Manifest V3) for the Odoo web client on `*.odoo.com` and `*.odoo.sh`.

## Installation

1. Unzip the archive into a stable folder (not a temporary one).
2. Open `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the unzipped folder.
5. Open an Odoo page and click the extension icon.

## Features

| Feature | Behavior |
| --- | --- |
| Hide trial banner | Removes the expiration warning (trial and staging) and any overlay blocking clicks |
| Developer mode | Single toggle: when turned on, reloads once with `?debug=1`; when off, does nothing |
| Drawer theme | Ten styles applied exclusively to the icon image |
| Caption color | Auto, light, or dark: separate control for text readability |
| Hide app names | Removes captions and enlarges icons, works with any theme |
| Wallpaper library | History of used images, highlighting recent ones and featuring a grid view |
| Background | Image or video, via link or local file, with dimming and blur controls |
| Rounded icons | Adjustable border radius on `.o_app_icon` and `.o_app.o_menuitem` |

### Themes

**A theme only affects the `.o_app_icon` image.** Never the `.o_app.o_menuitem` block, never the top bar. Painting the entire block produces two nested frames, because Odoo icons are already squares with their own background.

The background of an `<img>` sits behind the image, which is however opaque and covers the whole box. To make it visible, the themes use `box-sizing: border-box` plus `padding`: the drawing shrinks and the background emerges as a frame around it. No rule alters the footprint, so the grid remains intact.

| Theme | Icon treatment |
| --- | --- |
| Odoo default | no modification |
| Frosted glass | translucent frame with `backdrop-filter` |
| Midnight | dark frame, for light backgrounds |
| Daylight | light frame, for bright backgrounds |
| RGB neon | animated ring cycling through the color wheel |
| Aurora | gradient frame from aubergine to teal |
| Outline | just a thread of light, no surface |
| Lifted | no frame, deep shadow that lifts the icon |
| Greyscale | desaturated icons, color returns on hover |
| Paper | opaque ivory frame with a soft shadow |

The color of the captions and top bar is a **separate control** (`Auto`, `Light`, `Dark`): themes act on the icon, while text readability depends on the chosen background image, not the icon style. `Auto` leaves the original Odoo colors.

Every rule is bound to `body.o_home_menu_background`, the class that Odoo applies only while the main menu is open: entering an application stops the style from acting, and the working views remain the original ones.

### Wallpaper library

Every applied image, whether uploaded or pasted as a link, ends up in the history. The last five appear as strips below the controls; the `All wallpapers` button opens a two-column grid with a square crop, click selection, and a trash bin on hover. Videos do not enter the history.

### Video background

The video starts muted, on loop, without controls, behind the interface. It pauses when the tab goes to the background or when exiting the main menu, to avoid wasting CPU unnecessarily.

Via link, the direct address of an MP4 or WebM file is required: streaming pages (YouTube, Vimeo) cannot be played in a `<video>` tag. Via file, the limit is 24 MB; beyond that, it is better to use a link.

## Structure

```text
manifest.json
shared/defaults.js    defaults, normalization, and settings migration
shared/themes.js      stylesheets for themes and hidden captions
content/content.js    CSS injection, video layer, observers, debug redirect
popup/                settings interface
icons/