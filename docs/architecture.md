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
  index.html, mock-hass.ts   Standalone harness with simulated device.
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
  - Clicking the already-pending mode again does not send a second call.
  - A new request replaces the old one.
  - The pending state does not survive a page reload, which is acceptable.
- **Failure** is only reported when `callService` rejects. That clears the pending state and
  fires a `hass-notification` toast.

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
| Configured preset not in the control entity's `preset_modes` | Inline warning naming the preset (case-sensitive) |
| Configured entity ID not in `hass.states` | Inline warning naming the entity    |

Fan speed units come from `unit_of_measurement`; if the attribute is absent, the card shows the
bare number.

## Styling

- Root element is `ha-card`. All colours, radii and typography come from HA theme variables,
  each with a fallback: `--primary-color`, `--primary-text-color`, `--secondary-text-color`,
  `--disabled-text-color`, `--divider-color`, `--secondary-background-color`, `--error-color`,
  `--ha-card-border-radius`.
- No hard-coded colours, so light and dark mode follow the active theme automatically.
- Buttons are native `<button>` elements with `aria-pressed`, visible focus and a hit area of at
  least 40 px. The active mode uses the primary colour; pending uses an outline or progress style.
- Icons come from `ha-icon` with `mdi:` names (`mdi:fan-speed-1`, `mdi:fan-speed-2`,
  `mdi:fan-speed-3`, `mdi:fan-auto`).

### Visual design (M5)

The design direction is still to be selected in M5. Once chosen, it is recorded here with its
rationale and a table mapping each card state to how it looks. Constraints agreed up front:

- Compact by default: 6 columns × at most 3 rows in sections view.
- Fan speeds as text only, with no bars or gauges.
- Changes stay in the presentation layer. `view-model.ts` may gain additive, display-only fields
  but no changes in meaning.
- Newer HA design variables are used only with fallbacks, because the minimum version is 2024.11.
- Accessibility target is WCAG 2.2 AA. State is never shown by colour alone, status messages are
  announced through a polite live region, touch targets are at least 44 px high, and reduced
  motion is respected.

## Testing strategy

1. **Unit (Vitest, node):** `modes.ts`, `config.ts`, `view-model.ts`, table-driven.
2. **Component (Vitest + happy-dom):** mount the card with a fake `hass`, assert the DOM, assert
   `callService` arguments, assign a new `hass` and assert the update.
3. **Mock harness (`npm run dev`):** fake `hass` with controls for external mode changes,
   unavailability, unknown codes and a simulated device delay. Stubs `ha-card` and `ha-icon`.
4. **Visual gallery (`dev/`, M5):** every card state, in light and dark, at card widths of 280,
   360, 480 and 600+ px, on one page. Reviewed manually, with no pixel comparison. Reference
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
| Compact default size (6 × ≤3) | Fits alongside other cards in a section; users can still resize |
| Fan speeds as text only | A bar would need a new option or a hard-coded maximum RPM |
| Manual visual gallery, no pixel diffing | Avoids a heavy, font-sensitive dev dependency for a small project |
| Design prototypes stay out of `main` | Only the chosen direction ships; screenshots go in the PR |
