import { Agent } from "@mastra/core/agent";
import openai from "../models/openai";

import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: `You help users retrieve simple weather summaries.
When a user asks for conditions, call the get-weather tool with the location they mention.
You must always respond to the user.`,
  model: openai,
  tools: { weatherTool },
});
