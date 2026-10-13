import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/itho-hru-card.ts',
      formats: ['es'],
      fileName: () => 'itho-hru-card.js',
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/modes.ts', 'src/view-model.ts'],
      thresholds: { branches: 90 },
    },
  },
});
