import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
	name: "Weather Agent",
	instructions: `You help users retrieve simple weather summaries.
When a user asks for conditions, call the get-weather tool with the location they mention.
Always respond with the tool result.`,
	model: openai("gpt-4o-mini"),
	tools: { weatherTool },
});
