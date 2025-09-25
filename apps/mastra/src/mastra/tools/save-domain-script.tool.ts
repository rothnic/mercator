import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { saveExtractorScript } from "../resources/domain-knowledge";

const SaveSchema = z.object({
	domain: z
		.string()
		.min(1)
		.describe("Domain identifier, typically the hostname"),
	pathPattern: z
		.string()
		.min(1)
		.describe(
			"Path pattern (regex allowed) that the extractor should apply to",
		),
	script: z
		.string()
		.min(1, "Provide the finalized extraction script")
		.describe("JavaScript extraction script"),
	notes: z.string().optional(),
});

export const saveDomainScriptTool = createTool({
	id: "saveDomainScript",
	description:
		"Persist an extraction script so the agent can reuse it on future runs.",
	inputSchema: SaveSchema,
	outputSchema: z.object({
		pathPattern: z.string(),
		updatedAt: z.string(),
		runCount: z.number(),
	}),
	execute: async (context) => {
		const { domain, pathPattern, script, notes } = context.context;
		const persisted = await saveExtractorScript({
			domain,
			entry: {
				pathPattern,
				script,
				notes,
				updatedAt: new Date().toISOString(),
			},
		});
		return {
			pathPattern: persisted.pathPattern,
			updatedAt: persisted.updatedAt,
			runCount: persisted.runCount,
		};
	},
});
