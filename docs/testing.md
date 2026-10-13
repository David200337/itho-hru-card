# Testing

Automated checks (`npm run typecheck`, `npm test`, `npm run build`) run in CI. The mock harness
(`npm run dev`) and the gallery (`dev/gallery.html`) cover the visual states. This page is the
manual checklist for a real Home Assistant installation, run before every release.

## Setup

1. `npm run build`.
2. Copy `dist/itho-hru-card.js` to `config/www/`.
3. Add `/local/itho-hru-card.js?v=N` as a JavaScript module resource, and increase `N` after every
   rebuild. Hard-reload the browser.
4. Add the card with the entity IDs of the reference installation.
5. Keep a second browser tab on **Developer tools → States** to watch the mode sensor.

## Checklist

Record the Home Assistant version, the add-on version and the result below each run.

### Modes

- [x] Click Low. The status line says "Switching to Low…", then the Low button fills once the mode
  sensor reports `1`.
- [x] Repeat for Medium (`2`), High (`3`) and Auto (`24`).
- [x] Click the pending mode again while waiting. No second `set_preset_mode` call is made.
- [x] Set the mode with the physical remote. The card follows without interaction.
- [x] Select a mode the card has no button for (for example a timer or AutoNight from the add-on's
  web UI). No button is filled and the label names the mode or says "Mode N".

### Failure and availability

- [x] Take the add-on offline. The card shows "Unavailable" and disables the buttons, with a hint.
- [x] Bring it back online. The card recovers without a reload.
- [x] While offline, click a button. A rejected call shows a toast and a red outline for about 2.5 s,
  not "not confirmed".
- [x] Set `pending_timeout: 5` and request a mode. If the unit takes longer than that to report it,
  the amber "not confirmed" state appears and disappears after about 5 s, and the reported mode
  stays highlighted.
- [x] Restart Home Assistant. The card loads and shows the current mode once the entities return.
- [x] Use a wrong entity ID. The card shows a warning badge naming the entity.
- [x] Use a wrong preset name in `preset_modes`. The badge lists the preset.

### Appearance

- [x] Light and dark theme: text and buttons are readable, the active button is clearly different.
- [x] A custom theme with another primary colour. Switching themes updates the card live.
- [x] Masonry view.
- [x] Sections view at 12 and at 6 columns (resize the card in edit mode). Nothing is clipped.
- [x] Mobile app at about 360 px. Touch targets are comfortable.
- [x] Browser zoom at 200% is still usable.

## Results

| Date | Home Assistant | Add-on | Card | Result |
| ---- | -------------- | ------ | ---- | ------ |
|      |                |        |      |        |
