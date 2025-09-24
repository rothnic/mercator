import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	"apps/service/vitest.config.ts",
	"packages/html-utils/vitest.config.ts",
]);
