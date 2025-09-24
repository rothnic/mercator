import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { runScraper } from "./runner";

const productUrl =
	"https://demo.mercator.sh/products/precision-pour-over-kettle";

const createRuntimeRoot = async () => {
	return mkdtemp(join(tmpdir(), "mercator-runtime-"));
};

describe("runScraper", () => {
	test("generates and persists a script on the first run", async () => {
		const runtimeRoot = await createRuntimeRoot();

		try {
			const result = await runScraper({ url: productUrl, runtimeRoot });

			expect(result.reused).toBe(false);
			expect(result.validation.ok).toBe(true);
			expect(result.validation.value).toEqual({
				title: "Precision Pour-Over Kettle",
				price: "$149.00 USD",
			});

			const knowledgeRaw = await readFile(result.domainKnowledgePath, "utf8");
			const knowledge = JSON.parse(knowledgeRaw) as {
				resourceId: string;
				scripts: { pathRegex: string; script: string }[];
			};

			expect(knowledge.resourceId).toBe("demo.mercator.sh");
			expect(knowledge.scripts).toHaveLength(1);
			expect(knowledge.scripts[0]?.script).toContain("cheerio.load");

			const historyRaw = await readFile(result.historyFile, "utf8");
			const lines = historyRaw.trim().split("\n");
			expect(lines.length).toBeGreaterThanOrEqual(6);
		} finally {
			await rm(runtimeRoot, { recursive: true, force: true });
		}
	});

	test("reuses the stored script on the second run", async () => {
		const runtimeRoot = await createRuntimeRoot();

		try {
			const first = await runScraper({ url: productUrl, runtimeRoot });
			expect(first.reused).toBe(false);
			expect(first.validation.ok).toBe(true);

			const second = await runScraper({ url: productUrl, runtimeRoot });
			expect(second.reused).toBe(true);
			expect(second.validation.ok).toBe(true);

			const historyRaw = await readFile(second.historyFile, "utf8");
			const lines = historyRaw.trim().split("\n");
			const lastLine = JSON.parse(lines.at(-1) ?? "{}");
			expect(lastLine.action).toBe("validate");
		} finally {
			await rm(runtimeRoot, { recursive: true, force: true });
		}
	});
});
