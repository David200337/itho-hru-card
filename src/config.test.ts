import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_MODES, validateConfig } from './config';

const base = { mode_entity: 'sensor.mode', control_entity: 'fan.control' };

describe('validateConfig', () => {
  it('applies defaults', () => {
    expect(validateConfig(base)).toEqual({
      mode_entity: 'sensor.mode',
      control_entity: 'fan.control',
      supply_fan_entity: undefined,
      exhaust_fan_entity: undefined,
      preset_modes: DEFAULT_PRESET_MODES,
      pending_timeout: 60,
    });
  });

  it('keeps optional values and merges preset overrides', () => {
    const config = validateConfig({
      ...base,
      type: 'custom:itho-hru-card',
      title: 'Ventilation',
      supply_fan_entity: 'sensor.supply',
      exhaust_fan_entity: 'sensor.exhaust',
      preset_modes: { low: 'Laag' },
      pending_timeout: 12.5,
    });
    expect(config).toMatchObject({
      type: 'custom:itho-hru-card',
      title: 'Ventilation',
      supply_fan_entity: 'sensor.supply',
      exhaust_fan_entity: 'sensor.exhaust',
      pending_timeout: 12.5,
    });
    expect(config.preset_modes).toEqual({ ...DEFAULT_PRESET_MODES, low: 'Laag' });
  });

  it('does not mutate the defaults', () => {
    validateConfig({ ...base, preset_modes: { low: 'X' } });
    expect(DEFAULT_PRESET_MODES.low).toBe('Low');
  });

  it.each([
    [null, /must be an object/],
    ['text', /must be an object/],
    [[], /must be an object/],
    [{ control_entity: 'fan.control' }, /"mode_entity" is required/],
    [{ mode_entity: 'sensor.mode' }, /"control_entity" is required/],
    [{ ...base, control_entity: 'sensor.control' }, /fan entity \(fan\.\*\)/],
    [{ ...base, mode_entity: 'Sensor Mode' }, /"mode_entity" must be an entity ID/],
    [{ ...base, mode_entity: 5 }, /"mode_entity" must be an entity ID/],
    [{ ...base, supply_fan_entity: 'nodot' }, /"supply_fan_entity" must be an entity ID/],
    [{ ...base, exhaust_fan_entity: 'a.b.c' }, /"exhaust_fan_entity" must be an entity ID/],
    [{ ...base, title: 3 }, /"title" must be a string/],
    [{ ...base, preset_modes: 'Low' }, /"preset_modes" must be an object/],
    [{ ...base, preset_modes: { turbo: 'Turbo' } }, /"preset_modes.turbo" is not a known mode/],
    [{ ...base, preset_modes: { low: '' } }, /"preset_modes.low" must be a non-empty string/],
    [{ ...base, preset_modes: { low: 1 } }, /"preset_modes.low" must be a non-empty string/],
    [{ ...base, pending_timeout: 0 }, /"pending_timeout" must be a number/],
    [{ ...base, pending_timeout: -5 }, /"pending_timeout" must be a number/],
    [{ ...base, pending_timeout: '60' }, /"pending_timeout" must be a number/],
    [{ ...base, pending_timeout: Infinity }, /"pending_timeout" must be a number/],
  ])('rejects %j', (raw, message) => {
    expect(() => validateConfig(raw)).toThrow(message);
  });
});
