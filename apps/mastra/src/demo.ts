import { RuntimeContext } from "@mastra/core/runtime-context";
import { mastra } from "./mastra";
import { weatherTool } from "./mastra/tools/weather-tool";

const [, , ...input] = process.argv;
const providedLocation = input.join(" ").trim();
const defaultLocation = process.env.MASTRA_DEMO_LOCATION?.trim() ?? "Seattle, WA";
const userMessage = providedLocation.length > 0 ? providedLocation : defaultLocation;

if (providedLocation.length === 0) {
  console.info(
    `No location provided. Using default location "${userMessage}". Override by running: pnpm --filter @mercator/mastra run demo "<location>"`,
  );
}

const hasApiKey =
  typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 0;

async function run(): Promise<void> {
  if (!hasApiKey) {
    const runtimeContext = new RuntimeContext();
    const result = await weatherTool.execute({
      context: { location: userMessage },
      runtimeContext,
      suspend: () => Promise.resolve(undefined),
    });

    console.info(result.outlook);
    console.info("Set OPENAI_API_KEY to chat with the agent through OpenAI.");
    return;
  }

  const response = await mastra.getAgent("weatherAgent").generate(userMessage);
  console.log(response.text);
}

run().catch((error) => {
  console.error("Weather demo failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
