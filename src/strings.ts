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
  requestWaiting: (label: string) => `Requested ${label}, waiting for the device…`,
  requestNotConfirmed: (label: string) => `${label} not confirmed by the device yet`,
  requestFailed: (label: string) => `Could not set mode ${label}`,
  currentMode: 'Current mode',
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
