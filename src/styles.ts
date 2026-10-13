import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container: card / inline-size;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    /* "Not confirmed" amber: the theme's warning colour mixed toward the text colour, so the text
       stays readable (about 4.7:1 on HA's default light theme, about 10:1 on dark). */
    --_notice-color: var(--warning-color, #b26a00);
  }
  @supports (color: color-mix(in srgb, red 50%, blue)) {
    :host {
      --_notice-color: color-mix(
        in srgb,
        var(--warning-color, #b26a00) 55%,
        var(--primary-text-color, #212121)
      );
    }
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    color: var(--primary-text-color, #212121);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .badge {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: var(--primary-color, #03a9f4);
    background: rgba(3, 169, 244, 0.2);
    background: color-mix(in srgb, var(--primary-color, #03a9f4) 20%, transparent);
    --mdc-icon-size: 24px;
  }
  .badge.muted {
    color: var(--disabled-text-color, #9e9e9e);
    background: var(--secondary-background-color, #e5e5e5);
  }
  .text {
    min-width: 0;
    container-type: inline-size;
    display: flex;
    flex-direction: column;
  }
  .caption,
  .mode-label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .caption {
    font-size: 11px;
    line-height: 14px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--secondary-text-color, #727272);
  }
  .mode-label {
    font-size: 18px;
    line-height: 24px;
    font-weight: 500;
  }
  .secondary {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    font-size: 11px;
    line-height: 14px;
    font-weight: 400;
    color: var(--secondary-text-color, #727272);
    font-variant-numeric: tabular-nums;
  }
  .fan {
    display: flex;
    flex-wrap: wrap;
    column-gap: 4px;
  }
  /* A value is never split or truncated; its label and the fans wrap onto extra lines instead. */
  .fan-label,
  .fan-value {
    white-space: nowrap;
  }
  /* A hairline between the two fans, only when both fit on one line (otherwise it would dangle). */
  @container (min-width: 250px) {
    .fan + .fan::before {
      content: '';
      display: inline-block;
      width: 1px;
      height: 10px;
      margin-right: 12px;
      vertical-align: -1px;
      background: var(--divider-color, #e0e0e0);
    }
  }
  .segments {
    display: flex;
    gap: 6px;
  }

  /* Narrow cards (6 columns in a narrow section, or a phone): drop the badge and tighten up. */
  @container card (max-width: 240px) {
    .card {
      gap: 8px;
      padding: 8px;
    }
    .badge {
      display: none;
    }
    .segments {
      gap: 4px;
    }
    .segments button {
      padding: 0 1px;
      font-size: 10px;
    }
  }

  /* Very narrow: icons only; the label stays available to screen readers and as a tooltip. */
  @container card (max-width: 190px) {
    :host .segments button > span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  /* ---- mode buttons ---- */
  .segments button {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 48px;
    padding: 0 4px;
    font: inherit;
    font-size: 11px;
    font-weight: 500;
    color: var(--primary-text-color, #212121);
    background: var(--secondary-background-color, #e5e5e5);
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    transition:
      color 200ms var(--ease-out),
      background-color 150ms ease,
      transform 120ms var(--ease-out);
    --mdc-icon-size: 20px;
  }
  .segments button ha-icon,
  .segments button span {
    position: relative; /* above the fill layer */
  }
  /* The active fill grows in from slightly smaller, so a confirmed change reads as arriving. */
  .segments button::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--primary-color, #03a9f4);
    opacity: 0;
    transform: scale(0.9);
    transition:
      opacity 200ms var(--ease-out),
      transform 200ms var(--ease-out);
  }
  .segments button[aria-pressed='true'] {
    color: var(--text-primary-color, #fff);
    font-weight: 700;
  }
  .segments button[aria-pressed='true']::before {
    opacity: 1;
    transform: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .segments button:hover:not([disabled]):not([aria-pressed='true']) {
      background: color-mix(
        in srgb,
        var(--primary-text-color, #212121) 8%,
        var(--secondary-background-color, #e5e5e5)
      );
    }
  }
  .segments button:active:not([disabled]) {
    transform: scale(0.97);
    transition-duration: 100ms;
  }
  .segments button:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: 2px;
  }
  .segments button[disabled] {
    color: var(--disabled-text-color, #9e9e9e);
    cursor: default;
    opacity: 0.7;
  }

  /* Overlay ring used by the waiting / not-confirmed / failed states. Stays inside the button. */
  .segments button::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 2px solid var(--primary-color, #03a9f4);
    opacity: 0;
    pointer-events: none;
  }
  .segments button.waiting::after {
    border-width: 1.5px;
    animation: breathe 1100ms ease-in-out infinite alternate;
  }
  /* Temporary amber "not confirmed" feedback; fades out before the state is removed. */
  .segments button.stale::after {
    border: 1.5px solid var(--_notice-color);
    opacity: 1;
    animation: note-out 300ms var(--ease-out) var(--fade-delay, 4700ms) forwards;
  }
  .segments button.failed::after {
    border: 1.5px solid var(--error-color, #db4437);
    animation: fail-ring 2500ms linear forwards;
  }
  @keyframes breathe {
    from {
      opacity: 0.15;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes fail-ring {
    0%,
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* ---- messages ---- */
  .note,
  .banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    line-height: 16px;
    color: var(--secondary-text-color, #727272);
    --mdc-icon-size: 16px;
  }
  .note {
    animation: note-in 160ms var(--ease-out);
  }
  .status-line.transient {
    animation:
      note-in 160ms var(--ease-out),
      note-out 300ms var(--ease-out) var(--fade-delay, 2200ms) forwards;
  }
  .status-line .spinner {
    flex: none;
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    margin: 0 2px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 900ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* Icon and text share one colour, like the red rejected-call line. */
  .status-line.notice {
    color: var(--_notice-color);
  }
  /* The issue list expands and collapses: rows 0fr -> 1fr, plus a short fade and slide. */
  .issues-panel {
    display: grid;
    grid-template-rows: 0fr;
    margin-top: -12px; /* cancels the card's gap while collapsed; the padding below restores it */
    transition: grid-template-rows 200ms var(--ease-out);
  }
  .issues-panel[data-open] {
    grid-template-rows: 1fr;
  }
  .banners {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    overflow: hidden;
    padding-top: 12px;
    visibility: hidden;
    opacity: 0;
    transform: translateY(-6px);
    transition:
      opacity 160ms ease-out,
      transform 200ms var(--ease-out),
      visibility 0s linear 200ms;
  }
  .issues-panel[data-open] .banners {
    visibility: visible;
    opacity: 1;
    transform: none;
    transition-delay: 0s;
  }
  .banner {
    align-items: center;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--primary-text-color, #212121);
    --tint: var(--secondary-text-color, #727272);
    background: var(--secondary-background-color, #e5e5e5);
    background: color-mix(in srgb, var(--tint) 12%, transparent);
  }
  .banner ha-icon {
    flex: none;
    color: var(--tint);
  }
  .banner.warning {
    --tint: var(--warning-color, #b26a00);
  }

  /* A transient or unconfirmed message takes the fan line's place; issues fold into a badge. */
  .status-line {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    line-height: 14px;
    color: var(--secondary-text-color, #727272);
    animation: note-in 160ms var(--ease-out);
    --mdc-icon-size: 14px;
  }
  .status-line.error {
    color: var(--error-color, #db4437);
    font-weight: 500;
  }
  .issues {
    position: relative;
    flex: none;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 24px;
    padding: 0 8px 0 6px;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    color: var(--warning-color, #b26a00);
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 12px;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      transform 120ms var(--ease-out);
    --mdc-icon-size: 14px;
  }
  .issues:active {
    transform: scale(0.95);
  }
  .issues[aria-expanded='true'] {
    background: rgba(255, 166, 0, 0.16);
    background: color-mix(in srgb, var(--warning-color, #b26a00) 16%, transparent);
  }
  /* Extends the hit area to 44 px without changing the badge's size. */
  .issues::before {
    content: '';
    position: absolute;
    inset: -10px -8px;
  }
  .issues:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: 2px;
  }
  .head .text {
    flex: 1;
  }

  @keyframes note-in {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }
  @keyframes note-out {
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .segments button,
    .segments button::before {
      transition: none;
    }
    .segments button.waiting::after {
      animation: none;
      opacity: 1;
    }
    .status-line .spinner {
      animation: none;
      border-top-color: currentColor;
      border-right-color: transparent;
    }
    .note,
    .status-line {
      animation: none;
    }
    .issues-panel,
    .banners,
    .issues {
      transition: none;
    }
    .banners {
      transform: none;
    }
    .transient {
      animation: note-out 300ms linear var(--fade-delay, 2200ms) forwards;
    }
    .segments button.stale::after {
      animation: note-out 300ms linear var(--fade-delay, 4700ms) forwards;
    }
  }
`;
