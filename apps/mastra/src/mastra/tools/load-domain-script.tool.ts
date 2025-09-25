import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
	findExtractorForPath,
	loadDomainKnowledge,
} from "../resources/domain-knowledge";

const LoadSchema = z.object({
	domain: z.string().min(1).describe("Domain identifier"),
	pathname: z.string().min(1).describe("Pathname that should be matched"),
});

export const loadDomainScriptTool = createTool({
	id: "loadDomainScript",
	description:
		"Check whether an extraction script already exists for the requested path.",
	inputSchema: LoadSchema,
	outputSchema: z.object({
		found: z.boolean(),
		pathPattern: z.string().optional(),
		script: z.string().optional(),
		updatedAt: z.string().optional(),
		notes: z.string().optional(),
		runCount: z.number().optional(),
	}),
	execute: async (context) => {
		const { domain, pathname } = context.context;
		const knowledge = await loadDomainKnowledge(domain);
		const existing = findExtractorForPath(knowledge, pathname);
		if (!existing) {
			return { found: false as const };
		}
		return {
			found: true as const,
			pathPattern: existing.pathPattern,
			script: existing.script,
			updatedAt: existing.updatedAt,
			notes: existing.notes,
			runCount: existing.runCount,
		};
	},
});
