# AGENTS.md

Home Assistant Lovelace card (`custom:itho-hru-card`) for Itho Daalderop HRU ventilation units
running the ithowifi add-on. Built with TypeScript, Lit 3, Vite and Vitest, and distributed via HACS.

Read `docs/architecture.md` before changing behaviour. `docs/roadmap.md` lists the milestones and
open questions.

## Commands

```sh
npm ci              # install
npm run dev         # mock harness (dev/index.html)
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run build       # dist/itho-hru-card.js
```

## Rules

- Talk to Home Assistant only through `hass.states` and `hass.callService`. Never use MQTT,
  `mqtt.publish`, the add-on's HTTP API or custom websocket subscriptions.
- The mode sensor is the only source of truth for the current mode. Never display the control
  entity's state, and never update the displayed mode optimistically.
- A pending-request timeout means "not confirmed", not "failed". Only a rejected service call is
  an error.
- Keep logic in the pure modules (`config.ts`, `modes.ts`, `view-model.ts`) with unit tests. The
  Lit component renders and dispatches only.
- Use only the `ha-card` and `ha-icon` elements from HA. Style with HA theme variables, each with a
  fallback, and no hard-coded colours.
- Runtime dependency is `lit` only. Ask before adding any dependency, runtime or dev.
- Never hand-edit or commit `dist/`.
- Don't add abstractions, options or features beyond the current milestone in `docs/roadmap.md`.
- English UI strings, kept together in one place.

## Workflow

- One milestone per branch and per PR (`m<N>-<slug>`). Keep PRs focused.
- Done means typecheck, tests and build all pass, new logic has tests, and the docs are updated
  when behaviour or config changes.
- When an open question in `docs/roadmap.md` blocks you, stop and ask rather than guessing
  entity attributes or preset names.

## Git commits and signing

- The developer uses GPG-signed commits.
- Never request, access, export, or modify GPG private keys.
- Never change global Git signing configuration.
- Agent-created feature commits may be unsigned.
- When creating agent commits, use:
  `git -c commit.gpgsign=false commit -m "..."`
- Do not push commits or merge pull requests without explicit approval.
- Do not rewrite signed commits without explicit approval.
