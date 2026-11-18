import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { migrate: 'scripts/migrate.ts', seed: 'scripts/seed.ts' },
  format: ['esm'],
  noExternal: [/^@promptscope\//],
  clean: true,
  target: 'node24',
});
