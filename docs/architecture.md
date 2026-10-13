# Architecture

`itho-hru-card` is a Home Assistant Lovelace card for Itho Daalderop HRU ventilation units
(developed against an HRU ECO 350) running the
[Itho WiFi add-on](https://github.com/arjenhiemstra/ithowifi). The card talks only to Home
Assistant entities and services. It never communicates with MQTT or the add-on directly.

## Goals and non-goals

- Show the reported operating mode and fan speeds; offer Low / Medium / High / Auto.
- Follow device changes made anywhere (card, physical remote, automations, add-on web UI).
- Degrade gracefully when entities are missing, `unknown` or `unavailable`.
- Look native: Home Assistant theme variables only, automatic light/dark support.
- Non-goals for the MVP: visual editor, translations, timers, temperatures, bypass, other
  Itho device types. See [roadmap.md](roadmap.md).

## Technology

| Concern       | Choice                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| Language      | TypeScript, `strict`                                                   |
| UI            | Lit 3, bundled into the output (HA's internal Lit is not a public API) |
| Build         | Vite library mode → single ES module `dist/itho-hru-card.js`          |
| Tests         | Vitest; `happy-dom` environment for component tests                    |
| Formatting    | Prettier (no ESLint for now)                                           |
| HA types      | Small hand-written interfaces in `src/ha-types.ts`                    |
| Distribution  | HACS custom repository; built file attached to GitHub releases         |

Runtime dependencies: `lit` only. `custom-card-helpers` is deliberately not used (unmaintained,
stale types). Decorators use `experimentalDecorators: true` and `useDefineForClassFields: false`.

## Home Assistant integration contract

| Mechanism                         | Use                                                                  | Since       |
| --------------------------------- | -------------------------------------------------------------------- | ----------- |
| `setConfig(config)`               | Validate config; throw `Error` to show HA's error card               | long-standing |
| `hass` property                   | Set by HA on **every** state change in the system; sole data source  | long-standing |
| `hass.callService(domain, svc, data)` | Send commands                                                    | long-standing |
| `getCardSize()`                   | Masonry view sizing                                                  | long-standing |
| `getGridOptions()`                | Sections view sizing                                                 | 2024.11     |
| `window.customCards`              | Card picker entry                                                    | long-standing |
| `hass-notification` event         | Toast on failed service call                                         | long-standing |
| `ha-card`, `ha-icon`              | The only HA elements used; other `ha-*` elements are internal        | long-standing |

**Minimum supported Home Assistant version: 2024.11** (required by `getGridOptions`). Development
and verification happen on the current stable release. `getConfigForm` (planned for v0.2) must be
re-verified and may raise the minimum.

The card does not open its own websocket subscriptions. State objects in `hass.states` are
immutable and replaced on change, so `shouldUpdate()` compares the state objects of the
configured entities by reference and skips re-rendering for unrelated changes.

## Entities

Reference installation (entity IDs differ per installation and are always configured):

| Role                | Example entity                                                      | Notes |
| ------------------- | ------------------------------------------------------------------- | ----- |
| Reported mode       | `sensor.hru_350_actual_mode`                                         | Numeric code, e.g. `24` |
| Control             | `fan.attic_itho_daalderop_hru_eco_350_hru_co2_demand_fan`           | State is normally `unknown` |
| Supply fan speed    | `sensor.hru_350_supply_fan_actual`                                   | RPM |
| Exhaust fan speed   | `sensor.hru_350_exhaust_fan_actual`                                  | RPM |

All of these belong to the same Home Assistant device and MQTT integration. The add-on also
creates `sensor.attic_itho_daalderop_hru_eco_350_supply_fan` / `_exhaust_fan` (equivalent RPM
values), `..._pir_fan_speed_level` and `sensor.hru_350_requested_fanspeed`. These are not used
by the MVP.

## Configuration (MVP)

```yaml
type: custom:itho-hru-card
title: Ventilation                     # optional
mode_entity: sensor.hru_350_actual_mode                                   # required
control_entity: fan.attic_itho_daalderop_hru_eco_350_hru_co2_demand_fan   # required, fan.*
supply_fan_entity: sensor.hru_350_supply_fan_actual                      # optional
exhaust_fan_entity: sensor.hru_350_exhaust_fan_actual                    # optional
preset_modes:                          # optional; card mode → fan preset name
  low: Low
  medium: Medium
  high: High
  auto: Auto
pending_timeout: 60                    # optional, seconds
```

The defaults shown match the control entity's `preset_modes` attribute exactly, including
capitalization. Preset names are case-sensitive and are passed to the service unchanged. The
reference entity exposes:

```json
["Low", "Medium", "High", "Auto", "AutoNight", "Timer 10min", "Timer 20min", "Timer 30min"]
```

`AutoNight` and the timer presets are not offered in the MVP (see [roadmap.md](roadmap.md)).
Config keys describe roles, not HRU-specific hardware, so other Itho WiFi devices can reuse them
later. The recommended fan sensors are the `*_fan_actual` entities. The autodiscovered
`sensor.attic_itho_*_fan` entities belong to the same device and also work.

## Modules

```
src/
  itho-hru-card.ts  LitElement: setConfig, hass, render, click handlers. Thin.
  config.ts         Config type, defaults, validateConfig() → normalized config or throws.
  modes.ts          Mode code table, parseActualMode(), mode → preset lookup.
  view-model.ts     deriveViewModel(hass, config, pending, now) → plain object. Pure.
  ha-types.ts       Minimal HomeAssistant / HassEntity interfaces.
  styles.ts         Lit css`` using HA theme variables.
  strings.ts        All user-facing English strings.
dev/
  index.html, main.ts, mock-hass.ts   Standalone harness with simulated device.
  gallery.html, gallery.ts            Every card state at several widths and themes.
  ha-stubs.ts                         Stand-ins for ha-card and ha-icon.
```

Data flow:

```
HA ──hass──▶ card.shouldUpdate (relevant entities changed?)
                 │
                 ▼
       deriveViewModel(hass, config, pending, now) ──▶ render()
                                                         │ click
                                                         ▼
                         pending = {mode, requestedAt}; hass.callService('fan', 'set_preset_mode', …)
```

All decision logic (parsing, availability, pending reconciliation) lives in the pure modules.
The Lit component only renders the view model and dispatches service calls. There is no
services layer, store or event bus.

## Operating modes

`modes.ts` holds a single table; the source is the ithowifi wiki.

| Code | Mode        | MVP           |
| ---- | ----------- | ------------- |
| 1    | `low`       | button        |
| 2    | `medium`    | button        |
| 3    | `high`      | button        |
| 13   | `timer`     | display only  |
| 24   | `auto`      | button        |
| 25   | `autonight` | display only  |
| other| —           | "Mode N"      |

`parseActualMode(state)` returns one of:

- `{ kind: 'known', mode, code }`
- `{ kind: 'other', code }` for an integer not in the table
- `{ kind: 'unavailable' }` for a missing entity, `unknown`, `unavailable` or a non-integer value

Parsing uses `Number()` and accepts integers only, so `"24"` and `"24.0"` both work. It never throws.

The table is keyed by code, with no HRU-specific assumptions elsewhere. Supporting other Itho
devices later means adding or overriding a table, not restructuring.

## Reported state vs requested mode

The control entity's preset mode is fire-and-forget: the device never reports the preset back,
so the fan entity's state is normally `unknown`.

- **Reported state** is the mode sensor and nothing else. It is the only value shown as the
  current mode and the only thing that highlights the active button. The card never updates it
  optimistically.
- **The control entity's state is never displayed.** It is only:
  - the service target;
  - a source of `preset_modes`, used to warn about configured presets that don't exist;
  - an availability signal. `unavailable` or missing disables the buttons, while `unknown` is
    normal and keeps them enabled.
- **Requested mode** is local, short-lived card state: `pending = { mode, requestedAt }`.
  - It is set on click, before the service call.
  - It is cleared when the reported mode equals the requested mode.
  - After `pending_timeout` seconds without a match, the request is shown as **"not confirmed"**.
    This doesn't mean the command failed; the device may simply not have reported yet.
  - That feedback is temporary: a thin solid amber outline on the requested button plus
    "<Mode> not confirmed" in the status line under the mode. About 5 s after the timeout (an internal UI constant, not a config option) it
    fades out and the request is dropped, so the button is idle again. The reported mode stays
    highlighted throughout. If the device confirms in the meantime, it clears immediately.
  - Clicking the already-pending mode again does not send a second call.
  - A new request replaces the old one.
  - The pending state does not survive a page reload, which is acceptable.
- **Failure** is only reported when `callService` rejects. That clears the pending state, fires a
  `hass-notification` toast and marks the button red for 2.5 s (a display-only `failed` state in
  the component, not in the view model).

Because `now` is injected into `deriveViewModel`, the timeout logic is testable without fake
timers. The component schedules a single re-render at the timeout moment.

## Availability handling

| Situation                         | Display                                   |
| --------------------------------- | ----------------------------------------- |
| Mode entity missing/unavailable   | Mode shows "Unavailable"; no button active |
| Unknown mode code                 | "Mode N"; no button active                 |
| Fan entity missing/unavailable    | "—"                                        |
| Fan value non-numeric             | "—"                                        |
| Control entity missing/unavailable| Buttons disabled, with a hint             |
| Control entity `unknown`          | Normal (expected)                          |
| Configured preset not in the control entity's `preset_modes` | One combined line in `issues`, naming the presets (case-sensitive) |
| Configured entity ID not in `hass.states` | A line in `issues` naming the entity |

Fan speed units come from `unit_of_measurement`; if the attribute is absent, the card shows the
bare number.

## Styling

- Root element is `ha-card`. All colours, radii and typography come from HA theme variables,
  each with a fallback: `--primary-color`, `--primary-text-color`, `--secondary-text-color`,
  `--disabled-text-color`, `--divider-color`, `--secondary-background-color`, `--error-color`,
  `--ha-card-border-radius`.
- No hard-coded colours, so light and dark mode follow the active theme automatically.
- Buttons are native `<button>` elements with `aria-pressed`, visible focus and a hit area of at
  least 44 px. The active mode uses the primary colour; pending breathes an inset outline.
- Icons come from `ha-icon` with `mdi:` names (`mdi:fan-speed-1`, `mdi:fan-speed-2`,
  `mdi:fan-speed-3`, `mdi:fan-auto`).

### Visual design (M5)

**Chosen direction: "Tile with chip messages".** Chosen from throwaway prototypes of three layouts
(tile, readout, remote) and four message styles (inline, banner, chip, overlay).

- Header: an icon badge, then a small uppercase caption (the title, or "Current mode"), the mode in
  larger type, and the fan speeds in a lighter 11 px line. Hierarchy comes from size, weight and
  colour: caption 500, mode 500, fans 400.
- Four mode buttons in one row, icon above label, down to 280 px.
- Messages never take their own row, so the card keeps its height:
  - a rejected or unconfirmed request replaces the fan line;
  - warnings fold into a `⚠ N` badge that expands the list on click;
  - the control hint (buttons disabled) stays visible under the buttons.

| State | Look |
| --- | --- |
| Reported Low, Medium, High, Auto | That button filled with the primary colour (grows in over 200 ms) |
| AutoNight, Timer, unknown code | No button filled; the mode label names it |
| Mode unavailable | Muted badge, label "Unavailable" |
| Pending (waiting) | The requested button gets a thin inset outline that breathes (opacity only). The status line reads "Switching to Medium…" with a small spinner, in place of the fan line |
| Not confirmed | Thin solid amber outline on the button; the status line reads "Medium not confirmed" with an amber clock. Shown for about 5 s, then back to idle. Not red |
| Rejected call | Thin red outline on the button for 2.5 s; the status line shows the error and fades out; toast fires |
| Control unavailable or missing | Buttons disabled; hint under the buttons |
| Entity or preset warnings | `⚠ N` badge in the header; expands to tinted lines. Missing presets are merged into one line |
| Fan sensors missing | Fan line hidden |
| Fan value unusable | "—" |
| No title / long title | Caption falls back to "Current mode" / ellipsis with the full text on hover |

Motion uses only `opacity` and `transform` (plus a short colour fade), a strong ease-out
(`cubic-bezier(0.23, 1, 0.32, 1)`) and stays within 200 ms. `prefers-reduced-motion` keeps a static
ring for pending and removes the movement.

Constraints agreed up front:

- Default size in sections view is the full section width (12 columns) with automatic height
  (`rows: 'auto'`), and it can be shrunk to 6 columns. A section is 12 columns wide, so 6 columns
  can be as little as about 170 px; below 240 px the badge is dropped, and below 190 px the buttons
  show icons only (labels stay for screen readers and as tooltips). Configured fan speeds always
  stay visible and wrap onto extra lines.
- Fan speeds as text only, with no bars or gauges. Numbers are never truncated; the fan line wraps
  between the two values instead.
- Changes stay in the presentation layer. `view-model.ts` gained one additive, display-only field,
  `issues` (`warnings` with all missing presets merged into one line); `warnings` is unchanged.
- Newer HA design variables are used only with fallbacks, because the minimum version is 2024.11.
- Accessibility target is WCAG 2.2 AA. State is never shown by colour alone, status messages are
  announced through a live region, touch targets are at least 44 px, and reduced motion is
  respected.

## Testing strategy

1. **Unit (Vitest, node):** `modes.ts`, `config.ts`, `view-model.ts`, table-driven.
2. **Component (Vitest + happy-dom):** mount the card with a fake `hass`, assert the DOM, assert
   `callService` arguments, assign a new `hass` and assert the update.
3. **Mock harness (`npm run dev`):** fake `hass` with controls for external mode changes,
   unavailability, unknown codes and a simulated device delay. Stubs `ha-card` and `ha-icon`.
4. **Visual gallery (`dev/gallery.html`, M5):** every card state, in light, dark and a custom-primary
   theme, at card widths of 280, 360, 480 and 600 px, on one page. Open it with `npm run dev` and
   follow the link, or use `?theme=light|dark|custom|all`. Icons are loaded from the MDI set, so it
   needs a network connection. Reviewed manually, with no pixel comparison. Reference
   screenshots live in `docs/images/`.
5. **Real Home Assistant:** build into `config/www/` and register `/local/itho-hru-card.js?v=N` as
   a dashboard resource. Follow the manual checklist in `docs/testing.md` (added in milestone 6).

## Decision log

| Decision | Reason |
| --- | --- |
| Bundle Lit | HA does not expose its Lit as a stable API |
| No `custom-card-helpers` | Unmaintained; about 20 lines of own types suffice |
| Actual mode sensor is the only source of truth | Preset commands are fire-and-forget |
| Timeout means "not confirmed", not "failed" | Status reporting may lag; failure only comes from a rejected service call |
| `fan.set_preset_mode` only in MVP | Matches the reference installation; the domain → service mapping is isolated so `select` can be added |
| Visual editor deferred to v0.2 | Keeps the MVP small |
| English only in MVP | Strings are kept together to ease later i18n |
| Minimum HA 2024.11 | `getGridOptions` |
| Default 12 columns, auto height, min 6 columns | 6 columns was only about 150-170 px in a real section and too small. 8 or 9 columns (about 225-255 px) are below the 280 px minimum and leave odd gaps in a 12-column grid. Auto height avoids clipping when the narrow layout wraps |
| Fan speeds as text only | A bar would need a new option or a hard-coded maximum RPM |
| Manual visual gallery, no pixel diffing | Avoids a heavy, font-sensitive dev dependency for a small project |
| Design prototypes stay out of `main` | Only the chosen direction ships; screenshots go in the PR |
| Tile layout with chip messages | Compact, native to HA, and messages never change the card's height |
| "Not confirmed" feedback lasts 5 s, then the request is dropped | A permanent not-confirmed button looked like a stuck error; retrying was always allowed anyway |
| Mode buttons never change icon or label | A button is a ventilation mode, not a status. Status lives in the status line and in the outline. The status line takes the fan line's place, so the card keeps its height |
| Rejected call highlight is temporary (2.5 s) | A persistent error state looked like the device was stuck; the toast remains the durable signal |
| Missing presets merged in `issues`, not `warnings` | One line instead of four; keeps existing `warnings` semantics and tests |
