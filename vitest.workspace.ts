import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core/vitest.config.ts',
  'packages/fixtures/vitest.config.ts',
  'packages/agent-tools/vitest.config.ts',
  'apps/service/vitest.config.ts'
]);
