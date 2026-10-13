import { CONTROL_MODES, type ControlMode } from './modes';

export type PresetModes = Record<ControlMode, string>;

export interface IthoHruCardConfig {
  type?: string;
  title?: string;
  mode_entity: string;
  control_entity: string;
  supply_fan_entity?: string;
  exhaust_fan_entity?: string;
  preset_modes: PresetModes;
  /** Seconds before an unconfirmed request is shown as "not confirmed". */
  pending_timeout: number;
}

export const DEFAULT_PRESET_MODES: Readonly<PresetModes> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  auto: 'Auto',
};

export const DEFAULT_PENDING_TIMEOUT = 60;

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entityId(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !ENTITY_ID.test(value)) {
    throw new Error(
      `"${key}" must be an entity ID such as "sensor.example", got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Validates a raw card config and returns it with defaults applied. Throws readable errors. */
export function validateConfig(raw: unknown): IthoHruCardConfig {
  if (!isRecord(raw)) throw new Error('Card configuration must be an object');

  const mode_entity = entityId(raw, 'mode_entity');
  if (!mode_entity) throw new Error('"mode_entity" is required');
  const control_entity = entityId(raw, 'control_entity');
  if (!control_entity) throw new Error('"control_entity" is required');
  if (!control_entity.startsWith('fan.')) {
    throw new Error(`"control_entity" must be a fan entity (fan.*), got "${control_entity}"`);
  }

  if (raw.title !== undefined && typeof raw.title !== 'string') {
    throw new Error('"title" must be a string');
  }

  const preset_modes: PresetModes = { ...DEFAULT_PRESET_MODES };
  if (raw.preset_modes !== undefined) {
    if (!isRecord(raw.preset_modes)) throw new Error('"preset_modes" must be an object');
    for (const [key, value] of Object.entries(raw.preset_modes)) {
      if (!(CONTROL_MODES as readonly string[]).includes(key)) {
        throw new Error(
          `"preset_modes.${key}" is not a known mode (use ${CONTROL_MODES.join(', ')})`,
        );
      }
      if (typeof value !== 'string' || value === '') {
        throw new Error(`"preset_modes.${key}" must be a non-empty string`);
      }
      preset_modes[key as ControlMode] = value;
    }
  }

  let pending_timeout = DEFAULT_PENDING_TIMEOUT;
  if (raw.pending_timeout !== undefined) {
    const value = raw.pending_timeout;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(
        `"pending_timeout" must be a number of seconds greater than 0, got ${JSON.stringify(value)}`,
      );
    }
    pending_timeout = value;
  }

  return {
    ...(typeof raw.type === 'string' ? { type: raw.type } : {}),
    ...(raw.title !== undefined ? { title: raw.title as string } : {}),
    mode_entity,
    control_entity,
    supply_fan_entity: entityId(raw, 'supply_fan_entity'),
    exhaust_fan_entity: entityId(raw, 'exhaust_fan_entity'),
    preset_modes,
    pending_timeout,
  };
}
