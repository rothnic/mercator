import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
	id: "get-weather",
	description: "Get current weather for a location",
	inputSchema: z.object({
		location: z.string().describe("City name"),
	}),
	outputSchema: z.object({
		outlook: z.string().describe("Weather summary"),
	}),
	execute: async ({ context }) => {
		return {
			outlook: `The weather in ${context.location} is sunny`,
		};
	},
});
