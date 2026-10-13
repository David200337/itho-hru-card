import type { HassEntity } from './ha-types';

export type ModeId = 'low' | 'medium' | 'high' | 'timer' | 'auto' | 'autonight';

/** Modes the card can request (those with a button). */
export type ControlMode = 'low' | 'medium' | 'high' | 'auto';

export const CONTROL_MODES: readonly ControlMode[] = ['low', 'medium', 'high', 'auto'];

/** Itho `Actual Mode` codes (source: ithowifi wiki). */
export const MODE_CODES: Readonly<Record<number, ModeId>> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  13: 'timer',
  24: 'auto',
  25: 'autonight',
};

export type ParsedMode =
  | { kind: 'known'; mode: ModeId; code: number }
  | { kind: 'other'; code: number }
  | { kind: 'unavailable' };

const INTEGER_OR_DECIMAL = /^-?\d+(\.\d+)?$/;

/** Parses a state string as a number; undefined unless it is plain decimal notation. */
export function parseNumber(state: string): number | undefined {
  const text = state.trim();
  return INTEGER_OR_DECIMAL.test(text) ? Number(text) : undefined;
}

/** Interprets the mode sensor. Never throws. */
export function parseActualMode(entity: HassEntity | undefined): ParsedMode {
  if (!entity) return { kind: 'unavailable' };
  const code = parseNumber(entity.state);
  if (code === undefined || !Number.isInteger(code)) return { kind: 'unavailable' };
  const mode = MODE_CODES[code];
  return mode ? { kind: 'known', mode, code } : { kind: 'other', code };
}

export function isControlMode(mode: ModeId): mode is ControlMode {
  return (CONTROL_MODES as readonly string[]).includes(mode);
}
