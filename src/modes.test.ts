import { describe, expect, it } from 'vitest';
import type { HassEntity } from './ha-types';
import { isControlMode, parseActualMode } from './modes';

const sensor = (state: string): HassEntity => ({ entity_id: 'sensor.mode', state, attributes: {} });

describe('parseActualMode', () => {
  it.each([
    ['1', 'low'],
    ['2', 'medium'],
    ['3', 'high'],
    ['13', 'timer'],
    ['24', 'auto'],
    ['24.0', 'auto'],
    [' 25 ', 'autonight'],
  ])('%s → %s', (state, mode) => {
    expect(parseActualMode(sensor(state))).toMatchObject({ kind: 'known', mode });
  });

  it.each(['17', '0', '-1'])('%s → other', (state) => {
    expect(parseActualMode(sensor(state))).toEqual({ kind: 'other', code: Number(state) });
  });

  it.each(['abc', 'unknown', 'unavailable', '', '  ', '24.5', '0x18', '1e1', 'NaN', 'Infinity'])(
    '%j → unavailable',
    (state) => {
      expect(parseActualMode(sensor(state))).toEqual({ kind: 'unavailable' });
    },
  );

  it('treats a missing entity as unavailable', () => {
    expect(parseActualMode(undefined)).toEqual({ kind: 'unavailable' });
  });
});

describe('isControlMode', () => {
  it('is true only for modes with a button', () => {
    expect(isControlMode('auto')).toBe(true);
    expect(isControlMode('timer')).toBe(false);
    expect(isControlMode('autonight')).toBe(false);
  });
});
