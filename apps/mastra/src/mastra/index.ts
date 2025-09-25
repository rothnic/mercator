import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore } from "@mastra/core/storage";

import { extractorAgent } from "./agents/extractor-agent";

export const mastra = new Mastra({
	agents: {
		extractorAgent,
	},
	storage: new InMemoryStore(),
});

export type RegisteredAgent = "extractorAgent";
