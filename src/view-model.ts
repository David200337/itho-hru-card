import type { IthoHruCardConfig } from './config';
import type { HassEntity, HomeAssistant } from './ha-types';
import {
  CONTROL_MODES,
  isControlMode,
  parseActualMode,
  parseNumber,
  type ControlMode,
  type ModeId,
} from './modes';
import { strings } from './strings';

/** A requested mode awaiting confirmation; `requestedAt` is epoch milliseconds. */
export interface PendingRequest {
  mode: ControlMode;
  requestedAt: number;
}

export interface ModeView {
  kind: 'known' | 'other' | 'unavailable';
  label: string;
  mode?: ModeId;
  code?: number;
}

export interface ButtonView {
  mode: ControlMode;
  label: string;
  preset: string;
  /** Highlighted: the reported mode. */
  active: boolean;
  /** The requested mode, still awaiting confirmation. */
  pending: boolean;
}

export interface FanView {
  /** Formatted for display, e.g. "1200 rpm", or "—" when unusable. */
  text: string;
}

export interface ViewModel {
  title?: string;
  mode: ModeView;
  buttons: ButtonView[];
  controlsEnabled: boolean;
  controlHint?: string;
  /** Present while a request is unresolved. "not-confirmed" is not a failure. */
  pending?: { mode: ControlMode; status: 'waiting' | 'not-confirmed'; timeoutAt: number };
  /** True when the reported mode matched the pending request; the caller should drop it. */
  clearPending: boolean;
  supply?: FanView;
  exhaust?: FanView;
  warnings: string[];
}

function fanView(entity: HassEntity | undefined): FanView {
  const value = entity ? parseNumber(entity.state) : undefined;
  if (value === undefined) return { text: strings.noValue };
  const unit = entity?.attributes.unit_of_measurement;
  const text = entity!.state.trim();
  return { text: typeof unit === 'string' && unit !== '' ? `${text} ${unit}` : text };
}

function modeView(entity: HassEntity | undefined): ModeView {
  const parsed = parseActualMode(entity);
  switch (parsed.kind) {
    case 'known':
      return {
        kind: 'known',
        label: strings.modeLabels[parsed.mode],
        mode: parsed.mode,
        code: parsed.code,
      };
    case 'other':
      return { kind: 'other', label: strings.otherMode(parsed.code), code: parsed.code };
    default:
      return { kind: 'unavailable', label: strings.unavailable };
  }
}

export function deriveViewModel(
  hass: HomeAssistant,
  config: IthoHruCardConfig,
  pending: PendingRequest | undefined,
  now: number,
): ViewModel {
  const modeEntity = hass.states[config.mode_entity];
  const controlEntity = hass.states[config.control_entity];
  const mode = modeView(modeEntity);

  const warnings: string[] = [];
  const configured = [
    config.mode_entity,
    config.control_entity,
    config.supply_fan_entity,
    config.exhaust_fan_entity,
  ];
  for (const id of configured) {
    if (id && !hass.states[id]) warnings.push(strings.missingEntity(id));
  }

  // The control entity's own state is never displayed; `unknown` is normal.
  let controlsEnabled = true;
  let controlHint: string | undefined;
  if (!controlEntity) {
    controlsEnabled = false;
    controlHint = strings.controlMissing;
  } else if (controlEntity.state === 'unavailable') {
    controlsEnabled = false;
    controlHint = strings.controlUnavailable;
  }

  const confirmed = !!pending && mode.mode !== undefined && mode.mode === pending.mode;
  const timeoutAt = pending ? pending.requestedAt + config.pending_timeout * 1000 : 0;
  const activePending = pending && !confirmed ? pending : undefined;

  const buttons = CONTROL_MODES.map((id): ButtonView => ({
    mode: id,
    label: strings.modeLabels[id],
    preset: config.preset_modes[id],
    active: mode.mode !== undefined && isControlMode(mode.mode) && mode.mode === id,
    pending: activePending?.mode === id,
  }));

  return {
    ...(config.title !== undefined ? { title: config.title } : {}),
    mode,
    buttons,
    controlsEnabled,
    ...(controlHint ? { controlHint } : {}),
    ...(activePending
      ? {
          pending: {
            mode: activePending.mode,
            status: now >= timeoutAt ? 'not-confirmed' : 'waiting',
            timeoutAt,
          },
        }
      : {}),
    clearPending: confirmed,
    ...(config.supply_fan_entity ? { supply: fanView(hass.states[config.supply_fan_entity]) } : {}),
    ...(config.exhaust_fan_entity
      ? { exhaust: fanView(hass.states[config.exhaust_fan_entity]) }
      : {}),
    warnings,
  };
}
