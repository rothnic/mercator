import { mastra } from "./mastra";

const [, , rawUrl] = process.argv;
const targetUrl = rawUrl ?? "https://mercator.test/products/simple";

async function run(): Promise<void> {
	if (!process.env.OPENAI_API_KEY) {
		console.error("Set OPENAI_API_KEY before running the extractor demo.");
		process.exitCode = 1;
		return;
	}

	const agent = mastra.getAgent("extractorAgent");
	const url = new URL(targetUrl);
	const resourceId = url.hostname;
	const threadId = `extractor:${resourceId}${url.pathname}`;

	const stream = await agent.streamVNext(
		[
			{
				role: "user",
				content: `Build or reuse the extractor for ${targetUrl}. Return the final script and the JSON payload it produces.`,
			},
		],
		{
			memory: {
				resource: resourceId,
				thread: threadId,
			},
			maxSteps: 8,
			toolChoice: "auto",
		},
	);

	const output = await stream.getFullOutput();
	console.log("\n===== Extractor Summary =====\n");
	console.log(output.text.trim());

	if (output.toolCalls.length > 0) {
		console.log("\n===== Tool Calls =====\n");
		for (const call of output.toolCalls) {
			console.log(`• ${call.toolName}`);
		}
	}

	console.log("\nRun ID:", stream.runId);
}

run().catch((error) => {
	console.error(
		"Extractor demo failed:",
		error instanceof Error ? error.message : error,
	);
	process.exitCode = 1;
});
