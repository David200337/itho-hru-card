import { describe, expect, it } from 'vitest';
import { IthoHruCard } from './itho-hru-card';

describe('itho-hru-card', () => {
  it('registers the custom element', () => {
    expect(customElements.get('itho-hru-card')).toBe(IthoHruCard);
  });

  it('renders an ha-card with a title', async () => {
    const el = document.createElement('itho-hru-card') as IthoHruCard;
    document.body.appendChild(el);
    await el.updateComplete;
    const card = el.shadowRoot?.querySelector('ha-card') as (Element & { header?: string }) | null;
    expect(card).not.toBeNull();
    expect(card?.header).toBe('Itho HRU');
    el.remove();
  });
});
