# Roadmap

## MVP (v0.1.0): five milestones

Each milestone gets its own branch and pull request into `main`. A milestone is done when CI
(`npm run typecheck`, `npm test`, `npm run build`) passes and the acceptance criteria below are met.
Milestones are sequential.

### M1: Project scaffold (`m1-scaffold`)

- `package.json`, `tsconfig.json` (strict), `vite.config.ts` (library mode), Vitest
  (`happy-dom`), Prettier, `.gitignore` (includes `dist/`), MIT licence.
- `src/itho-hru-card.ts` contains a placeholder element that renders `ha-card` with a title.
- GitHub Actions workflow on push and PR: install, typecheck, test, build.

Acceptance:
- `npm ci && npm run build` produces exactly one ES module, `dist/itho-hru-card.js`, with Lit bundled.
- `npm test` runs at least one test.
- CI is green on the PR.

### M2: Core logic (`m2-core-logic`)

No Lit code. Covers `config.ts`, `modes.ts`, `view-model.ts` and `ha-types.ts`.

Acceptance:
- `validateConfig`:
  - requires `mode_entity` and `control_entity`;
  - accepts only `fan.*` for `control_entity`;
  - validates entity ID format and `pending_timeout > 0`;
  - applies the defaults;
  - throws readable messages.
- `parseActualMode` handles the following cases, with table tests:
  - `"24"` and `"24.0"` → auto;
  - `"17"` → other;
  - `"abc"`, `unknown`, `unavailable` and a missing entity → unavailable.
- `deriveViewModel` covers:
  - missing entity warnings;
  - a control entity that is `unavailable` (buttons disabled) or `unknown` (buttons enabled);
  - non-numeric fan values;
  - `unit_of_measurement` handling;
  - pending cleared on a matching mode;
  - pending marked "not confirmed" after the timeout, using an injected `now`.
- At least 90% branch coverage on `view-model.ts` and `modes.ts`.

### M3: Read-only card and dev harness (`m3-display`)

Acceptance:
- Card registration:
  - the element is registered once;
  - there is a `window.customCards` entry;
  - `setConfig` uses `validateConfig`;
  - `getCardSize`, `getGridOptions` and `getStubConfig` are implemented.
- Renders the current mode (label and icon) and the supply and exhaust speeds. Optional fan rows
  are hidden when not configured.
- `shouldUpdate` re-renders only when a configured entity's state object changes. A component
  test proves that a change to an unrelated entity does not re-render.
- Styling uses HA theme variables only and looks correct in HA's default light and dark themes.
- Mode buttons are rendered but inert. The active button follows the reported mode.
- The `npm run dev` harness can simulate an external mode change, an unavailable entity, an
  unknown code and a non-numeric fan value.

### M4: Mode control (`m4-control`)

Acceptance:
- Clicking a mode calls
  `hass.callService('fan', 'set_preset_mode', { entity_id, preset_mode })` with the configured
  preset (component test with a spy).
- Requested-mode handling:
  - the clicked button shows the requested state;
  - the reported mode stays highlighted until the device confirms;
  - after `pending_timeout` the request is shown as "not confirmed" (not as an error);
  - clicking the same mode again while pending sends no second call.
- A rejected service call clears the pending state and fires a `hass-notification`.
- Buttons are disabled while the control entity is unavailable or missing.
- A warning is shown when a configured preset is not in the entity's `preset_modes` attribute.
- The harness simulates device lag, so confirmation and timeout can be seen.

### M5: Release v0.1.0 (`m5-release`)

Acceptance:
- `hacs.json` with `filename` and `homeassistant: "2024.11.0"`; the `hacs/action` validation
  passes in CI.
- A release workflow attaches `itho-hru-card.js` to the GitHub release when a `v*` tag is pushed.
- The README covers:
  - installation, both as a HACS custom repository and manually;
  - a YAML example;
  - how to find the entity IDs;
  - a screenshot.
- `docs/testing.md` contains the real-HA checklist:
  - switch each mode from the card;
  - change the mode with the physical remote;
  - take the add-on offline;
  - restart HA;
  - check the light and dark themes;
  - check masonry and sections views.
- The checklist has been run against the reference installation.

## Later versions

| Version | Scope |
| --- | --- |
| v0.2 | Visual editor via `getConfigForm` (re-verify the minimum HA version), entity auto-detection in `getStubConfig` |
| v0.3 | Timer presets (`Timer 10min`, `Timer 20min`, `Timer 30min`; remaining time if exposed), `AutoNight` as a selectable mode, configurable visible modes |
| v0.4 | Temperatures (supply, exhaust, room, outdoor), bypass position, filter and error status, humidity and CO₂ |
| v0.5 | Translations (Dutch first); `select.*` control entities if users need them |
| v1.0 | Documentation and screenshots polished, submission to the HACS default repository |

Ideas that are deferred, with the reason:
- Other Itho WiFi devices (CVE and so on): out of scope until there is demand. The mode table and
  role-based config keys keep this possible.
- Using `sensor.hru_350_requested_fanspeed` or the PIR level: their meaning (for example `-0.99`
  and `-1`) is unclear and needs research first.
- Persisting the pending state across reloads: not worth the complexity.

## Open questions

1. **Status update interval.** How quickly does `sensor.hru_350_actual_mode` reflect a change? This
   checks whether the 60 s default timeout is sensible, and should be measured during M5.
2. **Mode codes for timer presets.** Do `Timer 10min`, `Timer 20min` and `Timer 30min` all report
   code 13? This needs to be known for v0.3.

## Resolved

- Control entity presets are `Low`, `Medium`, `High`, `Auto`, `AutoNight`, `Timer 10min`,
  `Timer 20min` and `Timer 30min`. The defaults use this exact spelling and capitalization.
- Recommended fan sensors are `sensor.hru_350_supply_fan_actual` and
  `sensor.hru_350_exhaust_fan_actual`. All entity IDs stay configurable.
