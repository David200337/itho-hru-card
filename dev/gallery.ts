import './ha-stubs';
import '../src/itho-hru-card';
import type { IthoHruCard } from '../src/itho-hru-card';
import type { HassEntity, HomeAssistant } from '../src/ha-types';
import { IDS } from './mock-hass';

/** Every card state, rendered statically at each width and theme for manual visual review. */

const WIDTHS = [280, 360, 480, 600];
const THEMES = [
  { id: 'light', label: 'Light', className: 'theme theme-light' },
  { id: 'dark', label: 'Dark', className: 'theme theme-dark' },
  { id: 'custom', label: 'Custom primary', className: 'theme theme-custom' },
] as const;

const entity = (
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity => ({
  entity_id: id,
  state,
  attributes,
});
const PRESETS = ['Low', 'Medium', 'High', 'Auto', 'AutoNight'];
const rpm = { unit_of_measurement: 'rpm' };

type States = Record<string, HassEntity | undefined>;

interface Scenario {
  name: string;
  note?: string;
  states?: (s: States) => void;
  config?: Record<string, unknown>;
  setup?: (el: IthoHruCard) => void;
}

const base = (): States => ({
  [IDS.mode]: entity(IDS.mode, '24'),
  [IDS.control]: entity(IDS.control, 'unknown', { preset_modes: PRESETS }),
  [IDS.supply]: entity(IDS.supply, '1200', rpm),
  [IDS.exhaust]: entity(IDS.exhaust, '1100', rpm),
});

const mode = (code: string) => (s: States) => (s[IDS.mode] = entity(IDS.mode, code));

const SCENARIOS: Scenario[] = [
  { name: 'Low', states: mode('1') },
  { name: 'Medium', states: mode('2') },
  { name: 'High', states: mode('3') },
  { name: 'Auto', states: mode('24') },
  { name: 'AutoNight', note: 'no button active', states: mode('25') },
  { name: 'Timer', note: 'no button active', states: mode('13') },
  { name: 'Unknown code', note: 'no button active', states: mode('17') },
  { name: 'Mode unavailable', states: mode('unavailable') },
  {
    name: 'Waiting',
    note: 'Medium requested, Auto reported',
    setup: (el) => (el.pending = { mode: 'medium', requestedAt: Date.now() + 3_600_000 }),
  },
  {
    name: 'Not confirmed',
    note: 'amber, temporary (5 s), repeats every 6 s; not an error',
    setup: (el) => {
      // Requested exactly `pending_timeout` (60 s by default) ago, so it has just timed out.
      const show = () => {
        el.pending = undefined;
        requestAnimationFrame(
          () => (el.pending = { mode: 'medium', requestedAt: Date.now() - 60_000 }),
        );
      };
      show();
      setInterval(show, 6000);
    },
  },
  {
    name: 'Rejected call',
    note: 'repeats every 3 s (really 2.5 s)',
    setup: (el) => {
      const flash = () => {
        el.failed = undefined;
        requestAnimationFrame(() => (el.failed = 'low'));
      };
      flash();
      setInterval(flash, 3000);
    },
  },
  {
    name: 'Control unavailable',
    states: (s) => (s[IDS.control] = entity(IDS.control, 'unavailable')),
  },
  { name: 'Control missing', states: (s) => delete s[IDS.control] },
  {
    name: 'Mode entity missing',
    note: 'warning badge, collapsed',
    states: (s) => delete s[IDS.mode],
  },
  {
    name: 'One preset missing',
    note: 'badge, expanded',
    states: (s) =>
      (s[IDS.control] = entity(IDS.control, 'unknown', {
        preset_modes: ['Low', 'Medium', 'Auto'],
      })),
    setup: (el) => (el.issuesOpen = true),
  },
  {
    name: 'Presets missing',
    note: 'merged into one line, expanded',
    states: (s) => (s[IDS.control] = entity(IDS.control, 'unknown', { preset_modes: [] })),
    setup: (el) => (el.issuesOpen = true),
  },
  {
    name: 'Fans not configured',
    config: { supply_fan_entity: undefined, exhaust_fan_entity: undefined },
  },
  {
    name: 'Fans unavailable',
    note: 'dash',
    states: (s) => {
      s[IDS.supply] = entity(IDS.supply, 'unavailable', rpm);
      s[IDS.exhaust] = entity(IDS.exhaust, 'abc', rpm);
    },
  },
  { name: 'No title', config: { title: undefined } },
  {
    name: 'Long title',
    config: {
      title: 'Attic ventilation unit — Itho Daalderop HRU ECO 350 with CO₂ demand control',
    },
  },
  {
    name: 'Worst case',
    note: 'long title, 5-digit speeds, unknown code, control unavailable, no presets',
    config: { title: 'Zolder ventilatie-unit — Itho Daalderop HRU ECO 350 met CO₂-sturing' },
    states: (s) => {
      s[IDS.mode] = entity(IDS.mode, '2147');
      s[IDS.supply] = entity(IDS.supply, '12000', rpm);
      s[IDS.exhaust] = entity(IDS.exhaust, '11999.5', rpm);
      s[IDS.control] = entity(IDS.control, 'unavailable', { preset_modes: [] });
    },
    setup: (el) => (el.issuesOpen = true),
  },
];

function makeCard(scenario: Scenario): IthoHruCard {
  const states = base();
  scenario.states?.(states);
  const hass: HomeAssistant = { states, callService: async () => undefined };
  const el = document.createElement('itho-hru-card') as IthoHruCard;
  el.setConfig({
    title: 'Ventilation',
    mode_entity: IDS.mode,
    control_entity: IDS.control,
    supply_fan_entity: IDS.supply,
    exhaust_fan_entity: IDS.exhaust,
    ...scenario.config,
  });
  el.hass = hass;
  scenario.setup?.(el);
  return el;
}

function render(themeIds: string[]) {
  const main = document.getElementById('main')!;
  main.innerHTML = '';
  for (const theme of THEMES.filter((t) => themeIds.includes(t.id))) {
    const section = document.createElement('section');
    section.className = theme.className;
    section.innerHTML = `<h2>${theme.label}</h2>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.append(document.createElement('div'));
    for (const w of WIDTHS) {
      const h = document.createElement('div');
      h.className = 'colhead';
      h.textContent = `${w} px`;
      grid.append(h);
    }
    for (const scenario of SCENARIOS) {
      const head = document.createElement('div');
      head.className = 'rowhead';
      head.innerHTML = `${scenario.name}${scenario.note ? `<small>${scenario.note}</small>` : ''}`;
      grid.append(head);
      for (const w of WIDTHS) {
        const cell = document.createElement('div');
        cell.style.width = `${w}px`;
        cell.append(makeCard(scenario));
        grid.append(cell);
      }
    }
    section.append(grid);
    main.append(section);
  }
}

// ---- theme picker, persisted in the URL (?theme=dark) ----
const picker = document.getElementById('themes')!;
const options = [...THEMES.map((t) => ({ id: t.id, label: t.label })), { id: 'all', label: 'All' }];
function select(id: string) {
  picker
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  const url = new URL(location.href);
  url.searchParams.set('theme', id);
  history.replaceState(null, '', url);
  render(id === 'all' ? THEMES.map((t) => t.id) : [id]);
}
for (const o of options) {
  const b = document.createElement('button');
  b.textContent = o.label;
  b.dataset.id = o.id;
  b.onclick = () => select(o.id);
  picker.append(b);
}
select(new URLSearchParams(location.search).get('theme') ?? 'light');
