import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const fixturesRoot = path.join(
	fileURLToPath(new URL("../../../..", import.meta.url)),
	"fixtures",
);

const supportedPaths: Record<string, string> = {
	"/products/simple": "product-simple.html",
};

const HtmlRequestSchema = z.object({
	url: z.string().url().describe("URL that should be inspected"),
});

export const loadFixtureHtmlTool = createTool({
	id: "loadFixtureHtml",
	description:
		"Load a known HTML fixture for a supported mercator demo URL so you can plan extraction scripts.",
	inputSchema: HtmlRequestSchema,
	outputSchema: z.object({
		html: z.string().describe("HTML contents of the mocked page"),
		source: z.literal("fixture"),
		fixturePath: z.string(),
	}),
	execute: async (context) => {
		const target = new URL(context.context.url);
		const fixtureName = supportedPaths[target.pathname];
		if (!fixtureName) {
			throw new Error(
				`No local fixture registered for ${target.pathname}. Supported paths: ${Object.keys(supportedPaths).join(", ") || "none"}.`,
			);
		}
		const fixturePath = path.join(fixturesRoot, fixtureName);
		const html = await fs.readFile(fixturePath, "utf8");
		return {
			html,
			source: "fixture" as const,
			fixturePath,
		};
	},
});
