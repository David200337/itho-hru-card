/** All user-facing English strings. */
export const strings = {
  unavailable: 'Unavailable',
  noValue: '—',
  otherMode: (code: number) => `Mode ${code}`,
  controlUnavailable: 'Control entity is unavailable',
  controlMissing: 'Control entity not found',
  missingEntity: (entityId: string) => `Entity not found: ${entityId}`,
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
