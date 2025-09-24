import { RuntimeContext } from "@mastra/core/runtime-context";

import { mastra } from "./mastra";
import { weatherTool } from "./mastra/tools/weather-tool";

const [, , ...input] = process.argv;
const userMessage = input.join(" ").trim();

if (userMessage.length === 0) {
	console.error("Usage: pnpm --filter @mercator/mastra run demo <location>");
	process.exitCode = 1;
	process.exit(1);
}

const hasApiKey =
	typeof process.env.OPENAI_API_KEY === "string" &&
	process.env.OPENAI_API_KEY.length > 0;

async function run(): Promise<void> {
	if (!hasApiKey) {
		const runtimeContext = new RuntimeContext();
		const result = await weatherTool.execute({
			context: { location: userMessage },
			runtimeContext,
		});

		console.info(result.outlook);
		console.info("Set OPENAI_API_KEY to chat with the agent through OpenAI.");
		return;
	}

	const response = await mastra.agents.weatherAgent.streamVNext(
		[
			{
				role: "user",
				content: userMessage,
			},
		],
		{ format: "aisdk" },
	);

	const output = await response.getFullOutput();
	console.info(output.text.trim());
}

run().catch((error) => {
	console.error(
		"Weather demo failed:",
		error instanceof Error ? error.message : error,
	);
	process.exitCode = 1;
});
