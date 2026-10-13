import { css } from 'lit';

export const styles = css`
  .content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    color: var(--primary-text-color, #212121);
  }
  .mode {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mode ha-icon {
    --mdc-icon-size: 32px;
    color: var(--primary-color, #03a9f4);
  }
  .mode.inactive ha-icon {
    color: var(--disabled-text-color, #9e9e9e);
  }
  .mode-caption {
    font-size: 0.85em;
    color: var(--secondary-text-color, #727272);
  }
  .mode-label {
    font-size: 1.4em;
    font-weight: 500;
  }
  .fans {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
  }
  .fan {
    display: flex;
    flex-direction: column;
  }
  .fan-label {
    font-size: 0.85em;
    color: var(--secondary-text-color, #727272);
  }
  .buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 8px;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 56px;
    min-width: 40px;
    padding: 8px;
    font: inherit;
    color: var(--primary-text-color, #212121);
    background: var(--secondary-background-color, #e5e5e5);
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: var(--ha-card-border-radius, 12px);
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: 2px;
  }
  button[aria-pressed='true'] {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color, #03a9f4);
    border-color: var(--primary-color, #03a9f4);
  }
  button[disabled] {
    color: var(--disabled-text-color, #9e9e9e);
  }
  .hint,
  .warning {
    font-size: 0.85em;
    color: var(--secondary-text-color, #727272);
  }
  .warning {
    color: var(--error-color, #db4437);
  }
`;
