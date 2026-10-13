import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { validateConfig, type IthoHruCardConfig } from './config';
import type { HomeAssistant } from './ha-types';
import { strings } from './strings';
import { styles } from './styles';
import { deriveViewModel, type FanView, type PendingRequest, type ViewModel } from './view-model';
import type { ControlMode } from './modes';

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description?: string; preview?: boolean }>;
  }
}

export class IthoHruCard extends LitElement {
  static styles = styles;

  static properties = {
    hass: { attribute: false },
    config: { state: true },
    pending: { state: true },
  };

  hass?: HomeAssistant;
  config?: IthoHruCardConfig;
  pending?: PendingRequest;

  private vm?: ViewModel;
  private timeoutTimer?: ReturnType<typeof setTimeout>;

  static getStubConfig() {
    return {
      mode_entity: 'sensor.hru_350_actual_mode',
      control_entity: 'fan.attic_itho_daalderop_hru_eco_350_hru_co2_demand_fan',
      supply_fan_entity: 'sensor.hru_350_supply_fan_actual',
      exhaust_fan_entity: 'sensor.hru_350_exhaust_fan_actual',
    };
  }

  setConfig(raw: unknown): void {
    this.config = validateConfig(raw);
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 };
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!this.config || !this.hass) return false;
    const oldHass = changed.get('hass') as HomeAssistant | undefined;
    if (changed.has('config') || changed.has('pending') || !oldHass) return true;
    const { mode_entity, control_entity, supply_fan_entity, exhaust_fan_entity } = this.config;
    return [mode_entity, control_entity, supply_fan_entity, exhaust_fan_entity].some(
      (id) => id !== undefined && oldHass.states[id] !== this.hass!.states[id],
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timeoutTimer);
  }

  protected willUpdate(): void {
    if (!this.config || !this.hass) return;
    const vm = deriveViewModel(this.hass, this.config, this.pending, Date.now());
    if (vm.clearPending) this.pending = undefined;
    this.vm = vm;

    // One re-render at the moment a waiting request becomes "not confirmed".
    clearTimeout(this.timeoutTimer);
    if (vm.pending?.status === 'waiting') {
      this.timeoutTimer = setTimeout(
        () => this.requestUpdate(),
        Math.max(0, vm.pending.timeoutAt - Date.now()),
      );
    }
  }

  private async select(mode: ControlMode): Promise<void> {
    const { config, hass, vm } = this;
    if (!config || !hass || !vm?.controlsEnabled) return;
    // Ignore duplicates only while the request is still waiting; after the timeout, resend.
    const { pending } = this;
    if (pending?.mode === mode && Date.now() < pending.requestedAt + config.pending_timeout * 1000)
      return;
    const request: PendingRequest = { mode, requestedAt: Date.now() };
    this.pending = request;
    try {
      await hass.callService('fan', 'set_preset_mode', {
        entity_id: config.control_entity,
        preset_mode: config.preset_modes[mode],
      });
    } catch {
      if (this.pending === request) this.pending = undefined;
      this.dispatchEvent(
        new CustomEvent('hass-notification', {
          detail: { message: strings.requestFailed(strings.modeLabels[mode]) },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private renderFan(label: string, fan: FanView | undefined) {
    if (!fan) return nothing;
    return html`<div class="fan">
      <span class="fan-label">${label}</span>
      <span class="fan-value">${fan.text}</span>
    </div>`;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const vm = this.vm;
    if (!vm) return nothing;
    return html`<ha-card .header=${vm.title}>
      <div class="content">
        <div class="mode ${vm.mode.kind === 'unavailable' ? 'inactive' : ''}">
          <ha-icon .icon=${vm.mode.icon}></ha-icon>
          <div>
            <div class="mode-caption">${strings.currentMode}</div>
            <div class="mode-label">${vm.mode.label}</div>
          </div>
        </div>
        ${
          vm.supply || vm.exhaust
            ? html`<div class="fans">
                ${this.renderFan(strings.supplyFan, vm.supply)}
                ${this.renderFan(strings.exhaustFan, vm.exhaust)}
              </div>`
            : nothing
        }
        <div class="buttons">
          ${vm.buttons.map(
            (b) =>
              html`<button
                type="button"
                class=${b.pending ? 'pending' : ''}
                aria-pressed=${b.active ? 'true' : 'false'}
                ?disabled=${!vm.controlsEnabled}
                @click=${() => this.select(b.mode)}
              >
                <ha-icon .icon=${b.icon}></ha-icon>
                <span>${b.label}</span>
              </button>`,
          )}
        </div>
        ${
          vm.pending
            ? html`<div class="status">
                ${
                  vm.pending.status === 'waiting'
                    ? strings.requestWaiting(strings.modeLabels[vm.pending.mode])
                    : strings.requestNotConfirmed(strings.modeLabels[vm.pending.mode])
                }
              </div>`
            : nothing
        }
        ${vm.controlHint ? html`<div class="hint">${vm.controlHint}</div>` : nothing}
        ${vm.warnings.map((w) => html`<div class="warning">${w}</div>`)}
      </div>
    </ha-card>`;
  }
}

if (!customElements.get('itho-hru-card')) {
  customElements.define('itho-hru-card', IthoHruCard);
  window.customCards = window.customCards ?? [];
  if (!window.customCards.some((c) => c.type === 'itho-hru-card')) {
    window.customCards.push({
      type: 'itho-hru-card',
      name: strings.cardName,
      description: strings.cardDescription,
    });
  }
}
