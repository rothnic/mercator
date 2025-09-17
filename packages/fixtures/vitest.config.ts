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
      '@mercator/core': resolve(__dirname, '../core/src/index.ts')
    }
  }
});
