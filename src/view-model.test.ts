import { describe, expect, it } from 'vitest';
import { validateConfig } from './config';
import type { HassEntity, HomeAssistant } from './ha-types';
import { deriveViewModel, type PendingRequest } from './view-model';

const config = validateConfig({
  mode_entity: 'sensor.mode',
  control_entity: 'fan.control',
  supply_fan_entity: 'sensor.supply',
  exhaust_fan_entity: 'sensor.exhaust',
  pending_timeout: 60,
});

const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity => ({
  entity_id,
  state,
  attributes,
});

function makeHass(overrides: Record<string, HassEntity | undefined> = {}): HomeAssistant {
  const states: Record<string, HassEntity | undefined> = {
    'sensor.mode': entity('sensor.mode', '24'),
    'fan.control': entity('fan.control', 'unknown'),
    'sensor.supply': entity('sensor.supply', '1200', { unit_of_measurement: 'rpm' }),
    'sensor.exhaust': entity('sensor.exhaust', '1100', { unit_of_measurement: 'rpm' }),
    ...overrides,
  };
  return { states, callService: async () => undefined };
}

const derive = (hass = makeHass(), pending?: PendingRequest, now = 0, cfg = config) =>
  deriveViewModel(hass, cfg, pending, now);

describe('mode display', () => {
  it('shows a known mode and highlights its button', () => {
    const vm = derive();
    expect(vm.mode).toEqual({
      kind: 'known',
      label: 'Auto',
      icon: 'mdi:fan-auto',
      mode: 'auto',
      code: 24,
    });
    expect(vm.buttons.map((b) => [b.mode, b.active])).toEqual([
      ['low', false],
      ['medium', false],
      ['high', false],
      ['auto', true],
    ]);
  });

  it('uses the configured preset names on the buttons', () => {
    const cfg = validateConfig({
      mode_entity: 'sensor.mode',
      control_entity: 'fan.control',
      preset_modes: { low: 'Laag' },
    });
    expect(derive(makeHass(), undefined, 0, cfg).buttons[0]).toMatchObject({
      mode: 'low',
      preset: 'Laag',
    });
  });

  it('shows display-only modes without highlighting a button', () => {
    const vm = derive(makeHass({ 'sensor.mode': entity('sensor.mode', '25') }));
    expect(vm.mode).toMatchObject({ kind: 'known', mode: 'autonight' });
    expect(vm.buttons.some((b) => b.active)).toBe(false);
  });

  it('shows "Mode N" for an unknown code', () => {
    const vm = derive(makeHass({ 'sensor.mode': entity('sensor.mode', '17') }));
    expect(vm.mode).toEqual({ kind: 'other', label: 'Mode 17', icon: 'mdi:fan-alert', code: 17 });
    expect(vm.buttons.some((b) => b.active)).toBe(false);
  });

  it.each(['unknown', 'unavailable', 'abc'])('shows Unavailable for mode state %s', (state) => {
    const vm = derive(makeHass({ 'sensor.mode': entity('sensor.mode', state) }));
    expect(vm.mode).toEqual({ kind: 'unavailable', label: 'Unavailable', icon: 'mdi:fan-alert' });
    expect(vm.buttons.some((b) => b.active)).toBe(false);
  });

  it('never derives the mode from the control entity', () => {
    const vm = derive(
      makeHass({
        'sensor.mode': entity('sensor.mode', 'unavailable'),
        'fan.control': entity('fan.control', 'on', { preset_mode: 'High' }),
      }),
    );
    expect(vm.mode.kind).toBe('unavailable');
    expect(vm.buttons.some((b) => b.active)).toBe(false);
  });
});

describe('control entity', () => {
  it('keeps controls enabled when the state is unknown', () => {
    const vm = derive();
    expect(vm.controlsEnabled).toBe(true);
    expect(vm.controlHint).toBeUndefined();
  });

  it('disables controls when unavailable', () => {
    const vm = derive(makeHass({ 'fan.control': entity('fan.control', 'unavailable') }));
    expect(vm.controlsEnabled).toBe(false);
    expect(vm.controlHint).toBe('Control entity is unavailable');
  });

  it('disables controls and warns when missing', () => {
    const vm = derive(makeHass({ 'fan.control': undefined }));
    expect(vm.controlsEnabled).toBe(false);
    expect(vm.controlHint).toBe('Control entity not found');
    expect(vm.warnings).toEqual(['Entity not found: fan.control']);
  });
});

describe('warnings', () => {
  it('is empty when all entities exist', () => {
    expect(derive().warnings).toEqual([]);
  });

  it('names every missing configured entity', () => {
    const vm = derive(
      makeHass({
        'sensor.mode': undefined,
        'sensor.supply': undefined,
        'sensor.exhaust': undefined,
      }),
    );
    expect(vm.warnings).toEqual([
      'Entity not found: sensor.mode',
      'Entity not found: sensor.supply',
      'Entity not found: sensor.exhaust',
    ]);
  });
});

describe('preset warnings', () => {
  const withPresets = (presets: unknown) =>
    makeHass({ 'fan.control': entity('fan.control', 'unknown', { preset_modes: presets }) });

  it('is silent when all configured presets are offered', () => {
    expect(derive(withPresets(['Low', 'Medium', 'High', 'Auto', 'AutoNight'])).warnings).toEqual(
      [],
    );
  });

  it('warns for each configured preset that is not offered', () => {
    const vm = derive(withPresets(['Low', 'Auto']));
    expect(vm.warnings).toEqual([
      'Preset "Medium" is not offered by fan.control',
      'Preset "High" is not offered by fan.control',
    ]);
  });

  it('is case-sensitive', () => {
    expect(derive(withPresets(['low', 'Medium', 'High', 'Auto'])).warnings).toHaveLength(1);
  });

  it('is silent when the attribute is absent or not a list', () => {
    expect(derive().warnings).toEqual([]);
    expect(derive(withPresets('Low')).warnings).toEqual([]);
  });
});

describe('issues', () => {
  const withPresets = (presets: unknown) =>
    makeHass({ 'fan.control': entity('fan.control', 'unknown', { preset_modes: presets }) });

  it('is empty when nothing is wrong', () => {
    expect(derive().issues).toEqual([]);
  });

  it('keeps a single missing preset as its own line', () => {
    expect(derive(withPresets(['Low', 'Medium', 'Auto'])).issues).toEqual([
      'Preset "High" is not offered by fan.control',
    ]);
  });

  it('merges several missing presets into one line', () => {
    const vm = derive(withPresets(['Low', 'Auto']));
    expect(vm.issues).toEqual(['Presets not offered by fan.control: "Medium", "High"']);
    // `warnings` is unchanged.
    expect(vm.warnings).toHaveLength(2);
  });

  it('lists missing entities before the merged preset line', () => {
    const hass = withPresets([]);
    delete hass.states['sensor.supply'];
    const vm = derive(hass);
    expect(vm.issues).toEqual([
      'Entity not found: sensor.supply',
      'Presets not offered by fan.control: "Low", "Medium", "High", "Auto"',
    ]);
  });
});

describe('fan rows', () => {
  it('formats value with unit', () => {
    const vm = derive();
    expect(vm.supply).toEqual({ text: '1200 rpm' });
    expect(vm.exhaust).toEqual({ text: '1100 rpm' });
  });

  it('shows the bare number without a unit', () => {
    const vm = derive(makeHass({ 'sensor.supply': entity('sensor.supply', '1200') }));
    expect(vm.supply?.text).toBe('1200');
  });

  it('ignores an empty unit', () => {
    const vm = derive(
      makeHass({ 'sensor.supply': entity('sensor.supply', '1200', { unit_of_measurement: '' }) }),
    );
    expect(vm.supply?.text).toBe('1200');
  });

  it.each(['unknown', 'unavailable', 'abc', ''])('shows a dash for %j', (state) => {
    const vm = derive(
      makeHass({ 'sensor.supply': entity('sensor.supply', state, { unit_of_measurement: 'rpm' }) }),
    );
    expect(vm.supply?.text).toBe('—');
  });

  it('shows a dash for a missing entity', () => {
    expect(derive(makeHass({ 'sensor.exhaust': undefined })).exhaust?.text).toBe('—');
  });

  it('omits rows that are not configured', () => {
    const cfg = validateConfig({ mode_entity: 'sensor.mode', control_entity: 'fan.control' });
    const vm = derive(makeHass(), undefined, 0, cfg);
    expect(vm.supply).toBeUndefined();
    expect(vm.exhaust).toBeUndefined();
  });
});

describe('title', () => {
  it('passes the configured title through', () => {
    const cfg = validateConfig({
      mode_entity: 'sensor.mode',
      control_entity: 'fan.control',
      title: 'Vent',
    });
    expect(derive(makeHass(), undefined, 0, cfg).title).toBe('Vent');
    expect(derive().title).toBeUndefined();
  });
});

describe('pending requests', () => {
  const requested: PendingRequest = { mode: 'high', requestedAt: 1_000 };

  it('has no pending state without a request', () => {
    const vm = derive();
    expect(vm.pending).toBeUndefined();
    expect(vm.clearPending).toBe(false);
  });

  it('waits while the reported mode differs; the reported mode stays highlighted', () => {
    const vm = derive(makeHass(), requested, 1_000 + 59_999);
    expect(vm.pending).toEqual({ mode: 'high', status: 'waiting', timeoutAt: 61_000 });
    expect(vm.clearPending).toBe(false);
    expect(vm.buttons.find((b) => b.mode === 'auto')).toMatchObject({
      active: true,
      pending: false,
    });
    expect(vm.buttons.find((b) => b.mode === 'high')).toMatchObject({
      active: false,
      pending: true,
    });
  });

  it('is not confirmed once the timeout elapses', () => {
    const vm = derive(makeHass(), requested, 61_000);
    expect(vm.pending).toEqual({ mode: 'high', status: 'not-confirmed', timeoutAt: 61_000 });
    expect(vm.clearPending).toBe(false);
  });

  it('is cleared when the reported mode matches', () => {
    const vm = derive(makeHass({ 'sensor.mode': entity('sensor.mode', '3') }), requested, 2_000);
    expect(vm.pending).toBeUndefined();
    expect(vm.clearPending).toBe(true);
    expect(vm.buttons.find((b) => b.mode === 'high')).toMatchObject({
      active: true,
      pending: false,
    });
  });

  it('is cleared on a late confirmation after the timeout', () => {
    const vm = derive(makeHass({ 'sensor.mode': entity('sensor.mode', '3') }), requested, 500_000);
    expect(vm.pending).toBeUndefined();
    expect(vm.clearPending).toBe(true);
  });

  it('is not cleared by an unavailable or unknown-code mode', () => {
    for (const state of ['unavailable', '17']) {
      const vm = derive(
        makeHass({ 'sensor.mode': entity('sensor.mode', state) }),
        requested,
        2_000,
      );
      expect(vm.clearPending).toBe(false);
      expect(vm.pending?.status).toBe('waiting');
    }
  });

  it('honours a custom pending_timeout', () => {
    const cfg = validateConfig({
      mode_entity: 'sensor.mode',
      control_entity: 'fan.control',
      pending_timeout: 5,
    });
    expect(derive(makeHass(), requested, 5_999, cfg).pending?.status).toBe('waiting');
    expect(derive(makeHass(), requested, 6_000, cfg).pending?.status).toBe('not-confirmed');
  });
});

describe('icons', () => {
  it('maps modes to icons', () => {
    expect(derive().mode.icon).toBe('mdi:fan-auto');
    expect(derive().buttons.map((b) => b.icon)).toEqual([
      'mdi:fan-speed-1',
      'mdi:fan-speed-2',
      'mdi:fan-speed-3',
      'mdi:fan-auto',
    ]);
    expect(derive(makeHass({ 'sensor.mode': entity('sensor.mode', '99') })).mode.icon).toBe(
      'mdi:fan-alert',
    );
    expect(derive(makeHass({ 'sensor.mode': undefined })).mode.icon).toBe('mdi:fan-alert');
  });
});
