import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node'
  },
  resolve: {
    alias: {
      '@mercator/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@mercator/fixtures': resolve(__dirname, '../../packages/fixtures/src/index.ts'),
      '@mercator/agent-tools': resolve(__dirname, '../../packages/agent-tools/src/index.ts'),
      '@mercator/recipe-store': resolve(__dirname, '../../packages/recipe-store/src/index.ts'),
      commander: resolve(__dirname, '../../node_modules/.pnpm/node_modules/commander/esm.mjs')
    }
  }
});
