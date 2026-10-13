import '../src/itho-hru-card';
import type { IthoHruCard } from '../src/itho-hru-card';
import { IDS, MockHass } from './mock-hass';

// Minimal stand-ins for the HA elements the card uses.
class HaCard extends HTMLElement {
  private _header?: string;
  set header(value: string | undefined) {
    this._header = value;
    const h = this.shadowRoot?.querySelector('h1');
    if (h) h.textContent = value ?? '';
  }
  connectedCallback() {
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>:host{display:block;background:var(--card-background-color);
      border-radius:var(--ha-card-border-radius);border:1px solid var(--divider-color)}
      h1{margin:0;padding:16px 16px 0;font-size:1.3em;font-weight:400;color:var(--primary-text-color)}</style>
      <h1></h1><slot></slot>`;
    this.header = this._header;
  }
}
class HaIcon extends HTMLElement {
  icon?: string;
  connectedCallback() {
    this.style.display = 'inline-block';
    this.textContent = '●';
  }
}
customElements.define('ha-card', HaCard);
customElements.define('ha-icon', HaIcon);

const mock = new MockHass();
const card = document.createElement('itho-hru-card') as IthoHruCard;
card.setConfig({
  title: 'Ventilation',
  mode_entity: IDS.mode,
  control_entity: IDS.control,
  supply_fan_entity: IDS.supply,
  exhaust_fan_entity: IDS.exhaust,
});
document.getElementById('card')!.appendChild(card);
mock.onChange((hass) => (card.hass = hass));

const actions: Record<string, () => void> = {
  'Mode: Low (external)': () => mock.set(IDS.mode, '1'),
  'Mode: Medium': () => mock.set(IDS.mode, '2'),
  'Mode: High': () => mock.set(IDS.mode, '3'),
  'Mode: Auto': () => mock.set(IDS.mode, '24.0'),
  'Mode: Timer (13)': () => mock.set(IDS.mode, '13'),
  'Unknown code 17': () => mock.set(IDS.mode, '17'),
  'Mode unavailable': () => mock.set(IDS.mode, 'unavailable'),
  'Mode entity missing': () => mock.remove(IDS.mode),
  'Control unavailable': () => mock.set(IDS.control, 'unavailable'),
  'Control normal': () => mock.set(IDS.control, 'unknown'),
  'Fan non-numeric': () => mock.set(IDS.supply, 'abc', { unit_of_measurement: 'rpm' }),
  'Fan unavailable': () => mock.set(IDS.exhaust, 'unavailable', { unit_of_measurement: 'rpm' }),
  'Fan speeds change': () => {
    mock.set(IDS.supply, String(900 + Math.round(Math.random() * 900)), {
      unit_of_measurement: 'rpm',
    });
    mock.set(IDS.exhaust, String(900 + Math.round(Math.random() * 900)), {
      unit_of_measurement: 'rpm',
    });
  },
  'Unrelated change (no re-render)': () => mock.set('sensor.unrelated', String(Math.random())),
  'Toggle dark theme': () => document.body.classList.toggle('dark'),
};
const controls = document.getElementById('controls')!;
for (const [label, fn] of Object.entries(actions)) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = fn;
  controls.appendChild(b);
}
