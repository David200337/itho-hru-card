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
    expect(el.getGridOptions()).toEqual({ columns: 12, rows: 'auto', min_columns: 6 });
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
    expect(root.querySelector('.caption')?.textContent).toBe('Ventilation');
    expect(root.querySelector('.mode-label')?.textContent).toBe('Auto');
    expect(root.querySelector('.fan')?.textContent).toBe('Supply fan 1200 rpm');
  });

  it('hides unconfigured fan rows', async () => {
    const el = await mount({ ...baseConfig, supply_fan_entity: undefined });
    expect(el.shadowRoot!.querySelector('.secondary')).toBeNull();
  });

  it('highlights the button of the reported mode', async () => {
    const hass = makeHass();
    const el = await mount(baseConfig, hass);
    const pressed = [...el.shadowRoot!.querySelectorAll('.segments button')].map((b) =>
      b.getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'false', 'false', 'true']);
  });

  it('follows an external mode change', async () => {
    const el = await mount();
    el.hass = makeHass({ 'sensor.mode': entity('sensor.mode', '3') });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.mode-label')?.textContent).toBe('High');
    expect(
      el.shadowRoot!.querySelectorAll('.segments button')[2]!.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows warnings for missing entities', async () => {
    const hass = makeHass();
    delete hass.states['sensor.supply'];
    const el = await mount(baseConfig, hass);
    const panel = el.shadowRoot!.querySelector('.issues-panel')!;
    expect(panel.hasAttribute('data-open')).toBe(false); // folded behind the badge
    el.shadowRoot!.querySelector<HTMLButtonElement>('.issues')!.click();
    await el.updateComplete;
    expect(panel.hasAttribute('data-open')).toBe(true);
    expect(panel.querySelector('.banner')?.textContent).toContain('sensor.supply');
  });
});

describe('accessibility', () => {
  it('labels the card and the mode buttons as groups', async () => {
    const el = await mount();
    const groups = [...el.shadowRoot!.querySelectorAll('[role="group"]')];
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Ventilation',
      'Ventilation mode',
    ]);
    expect(groups[1]!.querySelectorAll('button')).toHaveLength(4);
  });

  it('uses native buttons so Tab, Enter and Space work', async () => {
    const el = await mount();
    const buttons = [...el.shadowRoot!.querySelectorAll('.segments button')];
    expect(buttons.every((b) => b instanceof HTMLButtonElement && b.type === 'button')).toBe(true);
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

  const buttons = (el: IthoHruCard) => [
    ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.segments button'),
  ];
  /** The request state shown on the buttons and the status line. */
  const status = (el: IthoHruCard) => {
    return el.shadowRoot!.querySelector('.status-line')?.textContent?.trim();
  };
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
    expect(buttons(el)[0]!.classList.contains('waiting')).toBe(true);
    expect(buttons(el)[0]!.getAttribute('aria-busy')).toBe('true');
    expect(buttons(el).map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ]);
    expect(el.shadowRoot!.querySelector('.mode-label')?.textContent).toBe('Auto');
    expect(status(el)).toBe('Switching to Low…');
    expect(el.shadowRoot!.querySelector('.status-line .spinner')).not.toBeNull();
  });

  it('clears the request when the device confirms', async () => {
    const el = await mount(config);
    buttons(el)[0]!.click();
    await el.updateComplete;
    el.hass = makeHass({ 'sensor.mode': entity('sensor.mode', '1') });
    await el.updateComplete;
    expect(status(el)).toBeUndefined();
    expect(buttons(el)[0]!.classList.contains('waiting')).toBe(false);
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
    expect(buttons(el)[0]!.classList.contains('stale')).toBe(true);
    expect(notified).not.toHaveBeenCalled();
  });

  describe('temporary "not confirmed" feedback', () => {
    const pressed = (el: IthoHruCard) => buttons(el).map((b) => b.getAttribute('aria-pressed'));
    const idle = (el: IthoHruCard) =>
      buttons(el).every(
        (b) => !b.classList.contains('waiting') && !b.classList.contains('stale'),
      ) && !el.shadowRoot!.querySelector('.status-line');

    async function timedOut(hass = makeHass()) {
      const el = await mount(config, hass);
      buttons(el)[0]!.click();
      await el.updateComplete;
      vi.advanceTimersByTime(30_000);
      await el.updateComplete;
      return { el, hass };
    }

    it('goes back to idle about five seconds after the timeout', async () => {
      const { el, hass } = await timedOut();
      const notified = vi.fn();
      el.addEventListener('hass-notification', notified);
      expect(buttons(el)[0]!.classList.contains('stale')).toBe(true);
      expect(status(el)).toContain('not confirmed');

      vi.advanceTimersByTime(4_900);
      await el.updateComplete;
      expect(buttons(el)[0]!.classList.contains('stale')).toBe(true);

      vi.advanceTimersByTime(100);
      await el.updateComplete;
      expect(idle(el)).toBe(true);
      // The reported mode stays highlighted, and nothing was reported as an error.
      expect(pressed(el)).toEqual(['false', 'false', 'false', 'true']);
      expect(el.shadowRoot!.querySelector('.mode-label')?.textContent).toBe('Auto');
      expect(buttons(el)[0]!.classList.contains('failed')).toBe(false);
      expect(notified).not.toHaveBeenCalled();
      expect(hass.callService).toHaveBeenCalledTimes(1);
    });

    it('keeps the reported mode highlighted while it is shown', async () => {
      const { el } = await timedOut();
      expect(pressed(el)).toEqual(['false', 'false', 'false', 'true']);
    });

    it('lets the user retry the same mode right after the timeout', async () => {
      const { el, hass } = await timedOut();
      buttons(el)[0]!.click();
      await el.updateComplete;
      expect(hass.callService).toHaveBeenCalledTimes(2);
      expect(buttons(el)[0]!.classList.contains('waiting')).toBe(true);
      expect(buttons(el)[0]!.classList.contains('stale')).toBe(false);
    });

    it('lets the user retry after the feedback has gone', async () => {
      const { el, hass } = await timedOut();
      vi.advanceTimersByTime(5_000);
      await el.updateComplete;
      expect(idle(el)).toBe(true);
      buttons(el)[0]!.click();
      await el.updateComplete;
      expect(hass.callService).toHaveBeenCalledTimes(2);
      expect(status(el)).toContain('Switching to');
    });

    it('clears the feedback when the device confirms during the window', async () => {
      const { el } = await timedOut();
      vi.advanceTimersByTime(2_000);
      el.hass = makeHass({ 'sensor.mode': entity('sensor.mode', '1') });
      await el.updateComplete;
      expect(idle(el)).toBe(true);
      expect(pressed(el)).toEqual(['true', 'false', 'false', 'false']);
    });

    it('does not announce the message again on unrelated updates', async () => {
      const { el, hass } = await timedOut();
      const line = el.shadowRoot!.querySelector('.status-line');
      expect(line?.getAttribute('role')).toBe('status');
      vi.advanceTimersByTime(1_000);
      el.hass = {
        ...hass,
        states: { ...hass.states, 'sensor.supply': entity('sensor.supply', '900') },
      };
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.status-line')).toBe(line);
    });

    it('stays separate from the persistent warnings', async () => {
      const hass = makeHass({
        'fan.control': entity('fan.control', 'unknown', {
          preset_modes: ['Low', 'Medium', 'Auto'],
        }),
      });
      const { el } = await timedOut(hass);
      vi.advanceTimersByTime(5_000);
      await el.updateComplete;
      expect(idle(el)).toBe(true);
      // The configuration warning is still available behind the badge.
      expect(el.shadowRoot!.querySelector('.issues')?.textContent?.trim()).toBe('1');
    });
  });

  describe('mode buttons stay mode buttons', () => {
    const faces = (el: IthoHruCard) =>
      buttons(el).map((b) => ({
        icon: (b.querySelector('ha-icon') as unknown as { icon: string }).icon,
        label: b.querySelector('span')?.textContent,
      }));

    it('keeps every icon and label while waiting, unconfirmed, and after a rejection', async () => {
      const hass = makeHass();
      const el = await mount(config, hass);
      const idle = faces(el);
      expect(idle.map((f) => f.label)).toEqual(['Low', 'Medium', 'High', 'Auto']);

      buttons(el)[0]!.click();
      await el.updateComplete;
      expect(faces(el)).toEqual(idle);
      expect(status(el)).toBe('Switching to Low…');

      vi.advanceTimersByTime(30_000);
      await el.updateComplete;
      expect(buttons(el)[0]!.classList.contains('stale')).toBe(true);
      expect(faces(el)).toEqual(idle);
      expect(status(el)).toBe('Low not confirmed');

      vi.advanceTimersByTime(5_000);
      await el.updateComplete;
      hass.callService = vi.fn(async () => {
        throw new Error('nope');
      });
      buttons(el)[1]!.click();
      await vi.advanceTimersByTimeAsync(0);
      await el.updateComplete;
      expect(buttons(el)[1]!.classList.contains('failed')).toBe(true);
      expect(faces(el)).toEqual(idle);
    });

    it('keeps the reported mode highlighted in every state', async () => {
      const el = await mount(config);
      buttons(el)[0]!.click();
      await el.updateComplete;
      const reported = () => buttons(el).map((b) => b.getAttribute('aria-pressed'));
      expect(reported()).toEqual(['false', 'false', 'false', 'true']);
      vi.advanceTimersByTime(30_000);
      await el.updateComplete;
      expect(reported()).toEqual(['false', 'false', 'false', 'true']);
    });
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

  it('allows resending the same mode after the timeout and restarts the timer', async () => {
    const hass = makeHass();
    const el = await mount(config, hass);
    buttons(el)[0]!.click();
    await el.updateComplete;
    vi.advanceTimersByTime(29_000);
    buttons(el)[0]!.click();
    expect(hass.callService).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_000);
    await el.updateComplete;
    expect(status(el)).toContain('not confirmed');

    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledTimes(2);
    expect(status(el)).toContain('Switching to');

    // The new request has its own full timeout.
    vi.advanceTimersByTime(29_000);
    await el.updateComplete;
    expect(status(el)).toContain('Switching to');
    vi.advanceTimersByTime(1_000);
    await el.updateComplete;
    expect(status(el)).toContain('not confirmed');
  });

  it('notifies when a resend after the timeout is rejected', async () => {
    const hass = makeHass();
    const el = await mount(config, hass);
    buttons(el)[0]!.click();
    await el.updateComplete;
    vi.advanceTimersByTime(30_000);
    await el.updateComplete;
    hass.callService = vi.fn(async () => {
      throw new Error('nope');
    });
    const notified = vi.fn();
    el.addEventListener('hass-notification', notified);
    buttons(el)[0]!.click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(notified).toHaveBeenCalledTimes(1);
    expect(buttons(el).some((b) => b.classList.contains('stale'))).toBe(false);
  });

  it('does not present an already-matching sensor as an acknowledgment', async () => {
    const hass = makeHass(); // reported mode is already Auto
    const el = await mount(config, hass);
    buttons(el)[3]!.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledTimes(1);
    // No request or confirmation is shown; the highlight is just the reported mode.
    expect(status(el)).toBeUndefined();
    expect(buttons(el)[3]!.classList.contains('waiting')).toBe(false);
    expect(buttons(el)[3]!.getAttribute('aria-pressed')).toBe('true');
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
    expect(buttons(el).some((b) => b.classList.contains('waiting'))).toBe(false);
    expect(notified).toHaveBeenCalledTimes(1);
    expect((notified.mock.calls[0]![0] as CustomEvent).detail.message).toContain('Low');
  });

  it('shows a rejected request briefly and then clears it', async () => {
    const hass = makeHass();
    hass.callService = vi.fn(async () => {
      throw new Error('nope');
    });
    const el = await mount(config, hass);
    buttons(el)[0]!.click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(buttons(el)[0]!.classList.contains('failed')).toBe(true);
    expect(el.shadowRoot!.querySelector('.status-line.error')?.textContent).toContain('Low');

    await vi.advanceTimersByTimeAsync(2500);
    await el.updateComplete;
    expect(buttons(el)[0]!.classList.contains('failed')).toBe(false);
    expect(el.shadowRoot!.querySelector('.status-line')).toBeNull();
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
    const root = el.shadowRoot!;
    expect(root.querySelector('.issues')?.textContent?.trim()).toBe('1');
    root.querySelector<HTMLButtonElement>('.issues')!.click();
    await el.updateComplete;
    expect(root.querySelector('.banner')?.textContent).toContain('"High"');
    expect(root.querySelector('.issues')?.getAttribute('aria-expanded')).toBe('true');
  });
});
