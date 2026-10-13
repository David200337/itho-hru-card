import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IthoHruCard } from './itho-hru-card';
import type { HassEntity, HomeAssistant } from './ha-types';

const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity => ({ entity_id, state, attributes });

const baseConfig = {
  title: 'Ventilation',
  mode_entity: 'sensor.mode',
  control_entity: 'fan.control',
  supply_fan_entity: 'sensor.supply',
};

function makeHass(states: Record<string, HassEntity> = {}): HomeAssistant {
  return {
    states: {
      'sensor.mode': entity('sensor.mode', '24'),
      'fan.control': entity('fan.control', 'unknown'),
      'sensor.supply': entity('sensor.supply', '1200', { unit_of_measurement: 'rpm' }),
      'sensor.other': entity('sensor.other', '1'),
      ...states,
    },
    callService: vi.fn(async () => undefined),
  };
}

async function mount(config: object = baseConfig, hass = makeHass()) {
  const el = document.createElement('itho-hru-card') as IthoHruCard;
  el.setConfig(config);
  el.hass = hass;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('registration', () => {
  it('registers the element and a customCards entry once', () => {
    expect(customElements.get('itho-hru-card')).toBe(IthoHruCard);
    expect(window.customCards?.filter((c) => c.type === 'itho-hru-card')).toHaveLength(1);
  });

  it('implements the card API', () => {
    const el = document.createElement('itho-hru-card') as IthoHruCard;
    expect(el.getCardSize()).toBeGreaterThan(0);
    expect(el.getGridOptions().columns).toBe(12);
    expect(() => el.setConfig(IthoHruCard.getStubConfig())).not.toThrow();
  });

  it('validates the config in setConfig', () => {
    const el = document.createElement('itho-hru-card') as IthoHruCard;
    expect(() => el.setConfig({})).toThrow(/mode_entity/);
  });
});

describe('rendering', () => {
  it('shows the title, mode and fan speed', async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect((root.querySelector('ha-card') as unknown as { header: string }).header).toBe(
      'Ventilation',
    );
    expect(root.querySelector('.mode-label')?.textContent).toBe('Auto');
    expect(root.querySelector('.fan-value')?.textContent).toBe('1200 rpm');
  });

  it('hides unconfigured fan rows', async () => {
    const el = await mount({ ...baseConfig, supply_fan_entity: undefined });
    expect(el.shadowRoot!.querySelector('.fans')).toBeNull();
  });

  it('highlights the button of the reported mode', async () => {
    const hass = makeHass();
    const el = await mount(baseConfig, hass);
    const pressed = [...el.shadowRoot!.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'false', 'false', 'true']);
  });

  it('follows an external mode change', async () => {
    const el = await mount();
    el.hass = makeHass({ 'sensor.mode': entity('sensor.mode', '3') });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.mode-label')?.textContent).toBe('High');
    expect(el.shadowRoot!.querySelectorAll('button')[2]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows warnings for missing entities', async () => {
    const hass = makeHass();
    delete hass.states['sensor.supply'];
    const el = await mount(baseConfig, hass);
    expect(el.shadowRoot!.querySelector('.warning')?.textContent).toContain('sensor.supply');
  });
});

describe('shouldUpdate', () => {
  it('ignores unrelated entity changes but re-renders on configured ones', async () => {
    const hass = makeHass();
    const el = await mount(baseConfig, hass);
    const render = vi.spyOn(el, 'render');

    el.hass = { ...hass, states: { ...hass.states, 'sensor.other': entity('sensor.other', '2') } };
    await el.updateComplete;
    expect(render).not.toHaveBeenCalled();

    el.hass = {
      ...hass,
      states: { ...hass.states, 'sensor.supply': entity('sensor.supply', '900') },
    };
    await el.updateComplete;
    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe('mode control', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  const buttons = (el: IthoHruCard) => [...el.shadowRoot!.querySelectorAll('button')];
  const status = (el: IthoHruCard) => el.shadowRoot!.querySelector('.status')?.textContent?.trim();
  const config = { ...baseConfig, pending_timeout: 30 };

  it('calls fan.set_preset_mode with the configured preset', async () => {
    const hass = makeHass();
    const el = await mount({ ...config, preset_modes: { high: 'Boost' } }, hass);
    buttons(el)[2]!.click();
    expect(hass.callService).toHaveBeenCalledWith('fan', 'set_preset_mode', {
      entity_id: 'fan.control',
      preset_mode: 'Boost',
    });
  });

  it('shows the request while the reported mode stays highlighted', async () => {
    const el = await mount(config);
    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(buttons(el)[0]!.classList.contains('pending')).toBe(true);
    expect(buttons(el).map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ]);
    expect(el.shadowRoot!.querySelector('.mode-label')?.textContent).toBe('Auto');
    expect(status(el)).toContain('waiting');
  });

  it('clears the request when the device confirms', async () => {
    const el = await mount(config);
    buttons(el)[0]!.click();
    await el.updateComplete;
    el.hass = makeHass({ 'sensor.mode': entity('sensor.mode', '1') });
    await el.updateComplete;
    expect(status(el)).toBeUndefined();
    expect(buttons(el)[0]!.classList.contains('pending')).toBe(false);
    expect(buttons(el)[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows "not confirmed" after the timeout without an error', async () => {
    const hass = makeHass();
    const el = await mount(config, hass);
    const notified = vi.fn();
    el.addEventListener('hass-notification', notified);
    buttons(el)[0]!.click();
    await el.updateComplete;
    vi.advanceTimersByTime(30_000);
    await el.updateComplete;
    expect(status(el)).toContain('not confirmed');
    expect(buttons(el)[0]!.classList.contains('pending')).toBe(true);
    expect(notified).not.toHaveBeenCalled();
  });

  it('sends no second call for the same pending mode', async () => {
    const hass = makeHass();
    const el = await mount(config, hass);
    buttons(el)[0]!.click();
    await el.updateComplete;
    buttons(el)[0]!.click();
    expect(hass.callService).toHaveBeenCalledTimes(1);
    buttons(el)[1]!.click();
    expect(hass.callService).toHaveBeenCalledTimes(2);
  });

  it('clears the request and notifies when the service call is rejected', async () => {
    const hass = makeHass();
    hass.callService = vi.fn(async () => {
      throw new Error('nope');
    });
    const el = await mount(config, hass);
    const notified = vi.fn();
    el.addEventListener('hass-notification', notified);
    buttons(el)[0]!.click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(status(el)).toBeUndefined();
    expect(notified).toHaveBeenCalledTimes(1);
    expect((notified.mock.calls[0]![0] as CustomEvent).detail.message).toContain('Low');
  });

  it.each(['unavailable', null])(
    'disables buttons when the control entity is %s',
    async (state) => {
      const hass = makeHass();
      if (state === null) delete hass.states['fan.control'];
      else hass.states['fan.control'] = entity('fan.control', state);
      const el = await mount(config, hass);
      expect(buttons(el).every((b) => b.disabled)).toBe(true);
      buttons(el)[0]!.click();
      expect(hass.callService).not.toHaveBeenCalled();
    },
  );

  it('warns about a configured preset the entity does not offer', async () => {
    const hass = makeHass({
      'fan.control': entity('fan.control', 'unknown', { preset_modes: ['Low', 'Medium', 'Auto'] }),
    });
    const el = await mount(config, hass);
    expect(el.shadowRoot!.querySelector('.warning')?.textContent).toContain('"High"');
  });
});
