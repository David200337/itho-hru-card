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

- [ ] Click Low. The status line says "Switching to Low…", then the Low button fills once the mode
  sensor reports `1`.
- [ ] Repeat for Medium (`2`), High (`3`) and Auto (`24`).
- [ ] Click the pending mode again while waiting. No second `set_preset_mode` call is made.
- [ ] Set the mode with the physical remote. The card follows without interaction.
- [ ] Select a mode the card has no button for (for example a timer or AutoNight from the add-on's
  web UI). No button is filled and the label names the mode or says "Mode N".

### Failure and availability

- [ ] Take the add-on offline. The card shows "Unavailable" and disables the buttons, with a hint.
- [ ] Bring it back online. The card recovers without a reload.
- [ ] While offline, click a button. A rejected call shows a toast and a red outline for about 2.5 s,
  not "not confirmed".
- [ ] Set `pending_timeout: 5` and request a mode. If the unit takes longer than that to report it,
  the amber "not confirmed" state appears and disappears after about 5 s, and the reported mode
  stays highlighted.
- [ ] Restart Home Assistant. The card loads and shows the current mode once the entities return.
- [ ] Use a wrong entity ID. The card shows a warning badge naming the entity.
- [ ] Use a wrong preset name in `preset_modes`. The badge lists the preset.

### Appearance

- [ ] Light and dark theme: text and buttons are readable, the active button is clearly different.
- [ ] A custom theme with another primary colour. Switching themes updates the card live.
- [ ] Masonry view.
- [ ] Sections view at 12 and at 6 columns (resize the card in edit mode). Nothing is clipped.
- [ ] Mobile app at about 360 px. Touch targets are comfortable.
- [ ] Browser zoom at 200% is still usable.

## Measuring the status update interval

Open question 1 in [roadmap.md](roadmap.md): how quickly does the mode sensor reflect a change?

1. Request a mode from the card and note the time of the click.
2. In **Developer tools → States**, or the entity's history, note when the mode sensor changes.
3. Repeat several times, for both card requests and remote control changes.

Record the delay here. If it regularly approaches 60 s, raise the default `pending_timeout`.

## Results

| Date | Home Assistant | Add-on | Card | Result |
| ---- | -------------- | ------ | ---- | ------ |
|      |                |        |      |        |

Measured status update delay:
