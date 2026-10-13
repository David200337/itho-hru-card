/** All user-facing English strings. */
export const strings = {
  unavailable: 'Unavailable',
  noValue: '—',
  otherMode: (code: number) => `Mode ${code}`,
  controlUnavailable: 'Control entity is unavailable',
  controlMissing: 'Control entity not found',
  missingEntity: (entityId: string) => `Entity not found: ${entityId}`,
  modeLabels: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    timer: 'Timer',
    auto: 'Auto',
    autonight: 'Auto night',
  },
} as const;
