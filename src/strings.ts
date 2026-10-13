/** All user-facing English strings. */
export const strings = {
  unavailable: 'Unavailable',
  noValue: '—',
  otherMode: (code: number) => `Mode ${code}`,
  controlUnavailable: 'Control entity is unavailable',
  controlMissing: 'Control entity not found',
  missingEntity: (entityId: string) => `Entity not found: ${entityId}`,
  presetMissing: (preset: string, entityId: string) =>
    `Preset "${preset}" is not offered by ${entityId}`,
  presetsMissing: (presets: readonly string[], entityId: string) =>
    `Presets not offered by ${entityId}: ${presets.map((p) => `"${p}"`).join(', ')}`,
  issuesLabel: (count: number) => (count === 1 ? '1 warning' : `${count} warnings`),
  requestWaiting: (label: string) => `Switching to ${label}…`,
  requestNotConfirmed: (label: string) => `${label} not confirmed`,
  requestFailed: (label: string) => `Could not set mode ${label}`,
  currentMode: 'Current mode',
  modeGroup: 'Ventilation mode',
  supplyFan: 'Supply fan',
  exhaustFan: 'Exhaust fan',
  cardName: 'Itho HRU',
  cardDescription: 'Show the mode and fan speeds of an Itho Daalderop HRU ventilation unit.',
  modeLabels: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    timer: 'Timer',
    auto: 'Auto',
    autonight: 'Auto night',
  },
} as const;
