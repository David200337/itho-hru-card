import { LitElement, css, html } from 'lit';

const CARD_TITLE = 'Itho HRU';

export class IthoHruCard extends LitElement {
  static styles = css`
    .content {
      padding: 16px;
      color: var(--primary-text-color, #000);
    }
  `;

  render() {
    return html`<ha-card .header=${CARD_TITLE}>
      <div class="content">Placeholder</div>
    </ha-card>`;
  }
}

if (!customElements.get('itho-hru-card')) {
  customElements.define('itho-hru-card', IthoHruCard);
}
