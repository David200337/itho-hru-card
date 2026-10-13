import type { HassEntity, HomeAssistant } from '../src/ha-types';

export const IDS = {
  mode: 'sensor.hru_350_actual_mode',
  control: 'fan.hru_control',
  supply: 'sensor.hru_350_supply_fan_actual',
  exhaust: 'sensor.hru_350_exhaust_fan_actual',
};

const make = (id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id: id,
  state,
  attributes,
});

/** A fake `hass` whose states are replaced immutably, like Home Assistant's. */
export class MockHass {
  hass: HomeAssistant;
  private listeners: Array<(hass: HomeAssistant) => void> = [];

  constructor() {
    this.hass = {
      states: {
        [IDS.mode]: make(IDS.mode, '24'),
        [IDS.control]: make(IDS.control, 'unknown', {
          preset_modes: ['Low', 'Medium', 'High', 'Auto', 'AutoNight'],
        }),
        [IDS.supply]: make(IDS.supply, '1200', { unit_of_measurement: 'rpm' }),
        [IDS.exhaust]: make(IDS.exhaust, '1100', { unit_of_measurement: 'rpm' }),
        'sensor.unrelated': make('sensor.unrelated', '0'),
      },
      callService: async () => undefined,
    };
  }

  onChange(listener: (hass: HomeAssistant) => void): void {
    this.listeners.push(listener);
    listener(this.hass);
  }

  set(id: string, state: string, attributes?: Record<string, unknown>): void {
    const old = this.hass.states[id];
    this.hass = {
      ...this.hass,
      states: { ...this.hass.states, [id]: make(id, state, attributes ?? old?.attributes ?? {}) },
    };
    this.listeners.forEach((l) => l(this.hass));
  }

  remove(id: string): void {
    const states = { ...this.hass.states };
    delete states[id];
    this.hass = { ...this.hass, states };
    this.listeners.forEach((l) => l(this.hass));
  }
}
