import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { validateConfig, type IthoHruCardConfig } from './config';
import type { HomeAssistant } from './ha-types';
import { strings } from './strings';
import { styles } from './styles';
import {
  deriveViewModel,
  type ButtonView,
  type FanView,
  type PendingRequest,
  type ViewModel,
} from './view-model';
import type { ControlMode } from './modes';

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description?: string; preview?: boolean }>;
  }
}

/** How long a rejected request stays highlighted on its button. */
const FAILED_DISPLAY_MS = 2500;
/** How long "not confirmed" stays visible after `pending_timeout`, before the button goes idle. */
const NOT_CONFIRMED_DISPLAY_MS = 5000;
/** The CSS fade-out starts this long before the state is removed. */
const FADE_MS = 300;
const FADE_STYLE = `--fade-delay: ${NOT_CONFIRMED_DISPLAY_MS - FADE_MS}ms`;

export class IthoHruCard extends LitElement {
  static styles = styles;

  static properties = {
    hass: { attribute: false },
    config: { state: true },
    pending: { state: true },
    failed: { state: true },
    issuesOpen: { state: true },
  };

  hass?: HomeAssistant;
  config?: IthoHruCardConfig;
  pending?: PendingRequest;
  /** The mode whose service call was just rejected; shown briefly, then cleared. */
  failed?: ControlMode;
  issuesOpen = false;

  private vm?: ViewModel;
  private timeoutTimer?: ReturnType<typeof setTimeout>;
  private failedTimer?: ReturnType<typeof setTimeout>;
  /** Whether the last render showed a status line, so the fan line can animate back in. */
  private hadStatusLine = false;
  /** The fan text last shown per label, to animate only real changes of a visible value. */
  private shownFans = new Map<string, string>();

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
    return 3;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!this.config || !this.hass) return false;
    const oldHass = changed.get('hass') as HomeAssistant | undefined;
    if (
      changed.has('config') ||
      changed.has('pending') ||
      changed.has('failed') ||
      changed.has('issuesOpen') ||
      !oldHass
    )
      return true;
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
    clearTimeout(this.failedTimer);
  }

  protected willUpdate(): void {
    if (!this.config || !this.hass) return;
    const now = Date.now();
    let vm = deriveViewModel(this.hass, this.config, this.pending, now);
    // "Not confirmed" is temporary feedback: once its window has passed, drop the request so the
    // button returns to idle. The reported mode stays highlighted throughout.
    if (
      vm.pending?.status === 'not-confirmed' &&
      now >= vm.pending.timeoutAt + NOT_CONFIRMED_DISPLAY_MS
    ) {
      this.pending = undefined;
      vm = deriveViewModel(this.hass, this.config, undefined, now);
    }
    if (vm.clearPending) this.pending = undefined;
    this.vm = vm;

    // One re-render when a waiting request becomes "not confirmed", and one when that expires.
    clearTimeout(this.timeoutTimer);
    if (vm.pending) {
      const at =
        vm.pending.status === 'waiting'
          ? vm.pending.timeoutAt
          : vm.pending.timeoutAt + NOT_CONFIRMED_DISPLAY_MS;
      this.timeoutTimer = setTimeout(() => this.requestUpdate(), Math.max(0, at - Date.now()));
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
    this.failed = undefined;
    try {
      await hass.callService('fan', 'set_preset_mode', {
        entity_id: config.control_entity,
        preset_mode: config.preset_modes[mode],
      });
    } catch {
      if (this.pending === request) this.pending = undefined;
      this.failed = mode;
      clearTimeout(this.failedTimer);
      this.failedTimer = setTimeout(() => (this.failed = undefined), FAILED_DISPLAY_MS);
      this.dispatchEvent(
        new CustomEvent('hass-notification', {
          detail: { message: strings.requestFailed(strings.modeLabels[mode]) },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private renderButton(b: ButtonView, vm: ViewModel) {
    const stale = b.pending && vm.pending?.status === 'not-confirmed';
    const waiting = b.pending && !stale;
    const failed = this.failed === b.mode;
    const classes = [waiting && 'waiting', stale && 'stale', failed && 'failed']
      .filter(Boolean)
      .join(' ');
    return html`<button
      type="button"
      title=${b.label}
      class=${classes}
      style=${stale ? FADE_STYLE : nothing}
      aria-pressed=${b.active ? 'true' : 'false'}
      aria-busy=${waiting ? 'true' : 'false'}
      ?disabled=${!vm.controlsEnabled}
      @click=${() => this.select(b.mode)}
    >
      <ha-icon .icon=${b.icon}></ha-icon><span>${b.label}</span>
    </button>`;
  }

  /** A rejected request or an unconfirmed one takes the place of the fan line. */
  private renderStatusLine(vm: ViewModel) {
    if (this.failed) {
      return html`<div class="status-line error transient" role="alert">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>${strings.requestFailed(
          strings.modeLabels[this.failed],
        )}
      </div>`;
    }
    if (vm.pending?.status === 'waiting') {
      return html`<div class="status-line" role="status">
        <span class="spinner" aria-hidden="true"></span>${strings.requestWaiting(
          strings.modeLabels[vm.pending.mode],
        )}
      </div>`;
    }
    if (vm.pending?.status === 'not-confirmed') {
      return html`<div class="status-line notice transient" role="status" style=${FADE_STYLE}>
        <ha-icon icon="mdi:clock-alert-outline"></ha-icon>${strings.requestNotConfirmed(
          strings.modeLabels[vm.pending.mode],
        )}
      </div>`;
    }
    return nothing;
  }

  private renderFan(label: string, fan: FanView | undefined, enter: boolean) {
    if (!fan) return nothing;
    const previous = this.shownFans.get(label);
    this.shownFans.set(label, fan.text);
    const changed = !enter && previous !== undefined && previous !== fan.text;
    // Keyed on the text so a new value gets a fresh element, which replays the animation.
    return html`<span class="fan"
      ><span class="fan-label">${label}</span> ${keyed(
        fan.text,
        html`<span class="fan-value ${changed ? 'changed' : ''}">${fan.text}</span>`,
      )}</span
    >`;
  }

  private renderFans(vm: ViewModel, enter: boolean) {
    if (!vm.supply && !vm.exhaust) return nothing;
    return html`<div class="secondary ${enter ? 'enter' : ''}">
      ${this.renderFan(strings.supplyFan, vm.supply, enter)}${this.renderFan(
        strings.exhaustFan,
        vm.exhaust,
        enter,
      )}
    </div>`;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const vm = this.vm;
    if (!vm) return nothing;
    const statusLine = this.renderStatusLine(vm);
    const fansEnter = this.hadStatusLine && statusLine === nothing;
    this.hadStatusLine = statusLine !== nothing;
    return html`<ha-card>
      <div class="card" role="group" aria-label=${vm.title ?? strings.cardName}>
        <div class="head">
          <div class="badge ${vm.mode.kind === 'unavailable' ? 'muted' : ''}">
            <ha-icon .icon=${vm.mode.icon}></ha-icon>
          </div>
          <div class="text">
            <div class="caption" title=${vm.title ?? ''}>${vm.title ?? strings.currentMode}</div>
            <div class="mode-label">${vm.mode.label}</div>
            ${statusLine === nothing ? this.renderFans(vm, fansEnter) : statusLine}
          </div>
          ${
            vm.issues.length
              ? html`<button
                  type="button"
                  class="issues"
                  aria-expanded=${this.issuesOpen ? 'true' : 'false'}
                  aria-controls="issues"
                  aria-label=${strings.issuesLabel(vm.issues.length)}
                  @click=${() => (this.issuesOpen = !this.issuesOpen)}
                >
                  <ha-icon icon="mdi:alert-outline"></ha-icon>${vm.issues.length}
                </button>`
              : nothing
          }
        </div>
        <div class="segments" role="group" aria-label=${strings.modeGroup}>
          ${vm.buttons.map((b) => this.renderButton(b, vm))}
        </div>
        ${
          vm.controlHint
            ? html`<div class="note">
                <ha-icon icon="mdi:information-outline"></ha-icon>${vm.controlHint}
              </div>`
            : nothing
        }
        ${
          vm.issues.length
            ? html`<div
                class="issues-panel"
                id="issues"
                ?data-open=${this.issuesOpen}
                ?inert=${!this.issuesOpen}
              >
                <div class="banners">
                  ${vm.issues.map(
                    (w) =>
                      html`<div class="banner warning">
                        <ha-icon icon="mdi:alert-outline"></ha-icon><span>${w}</span>
                      </div>`,
                  )}
                </div>
              </div>`
            : nothing
        }
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
