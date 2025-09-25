import { promises as fs } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	findExtractorForPath,
	loadDomainKnowledge,
	recordExtractorRun,
	saveExtractorScript,
} from "./domain-knowledge";

const runtimeDir = path.join(process.cwd(), "apps/mastra/.runtime/domains");
const testDomain = "vitest.local";
const testFile = path.join(runtimeDir, `${testDomain}.json`);

afterEach(async () => {
	await fs.rm(testFile, { force: true });
});

describe("domain knowledge resource", () => {
	it("persists and reads extractor entries", async () => {
		const saved = await saveExtractorScript({
			domain: testDomain,
			entry: {
				pathPattern: "/products/simple",
				script: "module.exports = () => ({});",
				notes: "baseline extractor",
				updatedAt: new Date().toISOString(),
			},
		});

		expect(saved.runCount).toBe(0);

		const knowledge = await loadDomainKnowledge(testDomain);
		expect(knowledge.entries).toHaveLength(1);

		const match = findExtractorForPath(knowledge, "/products/simple");
		expect(match?.script).toContain("module.exports");
	});

	it("increments run metadata when recordExtractorRun is called", async () => {
		const entry = await saveExtractorScript({
			domain: testDomain,
			entry: {
				pathPattern: "/products/simple",
				script: "module.exports = () => ({});",
				notes: undefined,
				updatedAt: new Date().toISOString(),
			},
		});

		await recordExtractorRun({
			domain: testDomain,
			pathPattern: entry.pathPattern,
			runAt: new Date().toISOString(),
		});

		const knowledge = await loadDomainKnowledge(testDomain);
		const updated = knowledge.entries[0];
		expect(updated.runCount).toBe(1);
		expect(updated.lastRunAt).toBeTruthy();
	});
});
