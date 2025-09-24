import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { loadHtmlForUrl } from "@mercator/html-utils";

export const loadFixtureHtmlTool = createTool({
	id: "load_fixture_html",
	description:
		"Load HTML for known Mercator demo product pages or return a generic fallback snippet.",
	inputSchema: z.object({
		url: z.string().url(),
		fixturesDir: z.string().optional(),
	}),
	outputSchema: z.object({
		html: z.string(),
		source: z.enum(["fixture", "generic"]),
		fixtureId: z.string().optional(),
	}),
	execute: async ({ context }) => {
		const { url, fixturesDir } = context;
		return loadHtmlForUrl({ url, fixturesDir });
	},
});
