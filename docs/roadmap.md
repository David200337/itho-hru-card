# Roadmap

## MVP (v0.1.0): six milestones

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

### M5: UI/UX design and polish (`m5-ui-polish`)

Make the card compact, modern and visually native to Home Assistant without changing its
behaviour.

In scope:
- Layout, hierarchy, styles, icons and copy.
- `getCardSize` and `getGridOptions`.
- Accessibility, responsiveness, light and dark themes, motion.
- A visual review gallery in `dev/`.

Out of scope: new config options, new features and translations.

Phases:
1. Audit the current card and capture baseline screenshots.
2. Explore two or three design directions as throwaway prototypes covering the key states.
3. Select a direction and record the choice and reasons in `docs/architecture.md`.
4. Implement it.
5. Do the accessibility, responsive and theme pass.
6. Verify visually in the gallery, then on real HA.

Acceptance:

- **Behaviour unchanged**
  - `config.ts` and `modes.ts` are unchanged.
  - `view-model.ts` may only gain additive, display-only fields, with tests. Examples are raw
    numeric fan values, a combined status line, or locale number formatting. No existing field
    changes meaning.
  - `select()`, `shouldUpdate` and `willUpdate` behave as before.
  - Existing unit tests pass unmodified. In component tests only element selectors may change.
  - The config schema is unchanged. There are no new dependencies, and the only HA elements used
    are `ha-card` and `ha-icon`.
- **State coverage.** Each state has a deliberate design:
  - reported Low, Medium, High or Auto (button active);
  - AutoNight, Timer or an unknown code (no button active);
  - mode unavailable;
  - pending (waiting);
  - not confirmed, clearly different from an error;
  - control unavailable or missing (buttons disabled, with an explanation);
  - missing entity and missing preset warnings, with a fitting severity;
  - fan sensors not configured, and fan values unavailable;
  - with and without a title, including a long title.
- **Compact and responsive**
  - Default size is 6 columns by at most 3 rows in sections view (`getGridOptions`). With the
    default config and no warnings, the card fits without clipping. `getCardSize` matches.
  - No overflow, clipping or overlap at card widths of 280, 360, 480 and 600+ px.
  - The four mode buttons stay on one row down to 280 px.
  - Works in masonry, sections (6 and 12 columns) and panel views, and in the mobile app at 360 px.
- **Native look and theming**
  - Uses HA theme variables only, each with a fallback, and follows HA's spacing, radius and type
    conventions.
  - Newer HA design variables are only used with fallbacks (minimum version 2024.11).
  - Correct in HA's default light and dark themes and in one custom theme with a different
    primary colour.
  - Theme changes apply live, without a reload.
  - Fan speeds are shown as text only.
- **Accessibility**
  - WCAG 2.2 AA contrast in the default light and dark themes: 4.5:1 for text, 3:1 for UI
    boundaries and state indicators.
  - Active, pending and disabled states are never shown by colour alone.
  - The mode buttons form a labelled group.
  - Buttons work with Tab, Enter and Space, show a visible focus ring, and keep `aria-pressed`
    tied to the reported mode.
  - Pending and not-confirmed messages are announced once through a polite live region.
  - Touch targets are at least 44 px high.
  - Usable at 200% zoom.
  - Motion lasts 200 ms or less, only changes colour, opacity or position, runs only when a
    value changes, and is disabled when the user prefers reduced motion.
  - Component tests cover the group label, the live region, `aria-pressed` and the disabled state.
- **Visual testing**
  - A gallery page in `dev/` shows every state, in light and dark, at the target widths, on one
    page. There is no automated pixel comparison.
  - Reference screenshots of the final design are committed under `docs/images/`.
  - The real-HA checks pass: light and dark, desktop and the mobile app, masonry and sections
    views.
- **Docs**
  - `docs/architecture.md` describes the chosen direction and has a table mapping each state to
    how it looks.
  - Exploration prototypes are not merged into `main`; their screenshots go in the PR description.

### M6: Release v0.1.0 (`m6-release`)

Acceptance:
- `hacs.json` with `filename` and `homeassistant: "2024.11.0"`; the `hacs/action` validation
  passes in CI.
- A release workflow attaches `itho-hru-card.js` to the GitHub release when a `v*` tag is pushed.
- The README covers:
  - installation, both as a HACS custom repository and manually;
  - a YAML example;
  - how to find the entity IDs;
  - a screenshot (reused from M5's `docs/images/`).
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
   checks whether the 60 s default timeout is sensible, and should be measured during M6.
2. **Mode codes for timer presets.** Do `Timer 10min`, `Timer 20min` and `Timer 30min` all report
   code 13? This needs to be known for v0.3.

## Resolved

- Control entity presets are `Low`, `Medium`, `High`, `Auto`, `AutoNight`, `Timer 10min`,
  `Timer 20min` and `Timer 30min`. The defaults use this exact spelling and capitalization.
- Recommended fan sensors are `sensor.hru_350_supply_fan_actual` and
  `sensor.hru_350_exhaust_fan_actual`. All entity IDs stay configurable.
