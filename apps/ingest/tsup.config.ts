import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  noExternal: [/^@promptscope\//],
  clean: true,
  sourcemap: true,
  target: 'node24',
});
