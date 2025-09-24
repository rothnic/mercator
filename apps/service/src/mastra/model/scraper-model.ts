import { createOpenAI } from "@ai-sdk/openai";
import type {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import type { MastraLanguageModel } from "@mastra/core/agent";

import { FALLBACK_SCRIPT } from "../../agent/scraper-agent";

const buildFallbackPayload = () =>
	JSON.stringify({
		script: FALLBACK_SCRIPT,
		reused: false,
		notes: "Generated deterministic fallback Cheerio extractor.",
	});

const createFallbackStream = (payload: string) =>
	new ReadableStream<LanguageModelV1StreamPart>({
		start(controller) {
			controller.enqueue({ type: "text-delta", textDelta: payload });
			controller.enqueue({
				type: "finish",
				finishReason: "stop",
				usage: { promptTokens: 0, completionTokens: 0 },
			});
			controller.close();
		},
	});

const createDeterministicModel = (): LanguageModelV1 => {
	const payload = buildFallbackPayload();
	return {
		specificationVersion: "v1",
		provider: "deterministic",
		modelId: "mercator-cheerio-fallback",
		defaultObjectGenerationMode: "json",
		supportsStructuredOutputs: true,
		doGenerate: async (_options: LanguageModelV1CallOptions) => {
			return {
				text: payload,
				finishReason: "stop",
				usage: { promptTokens: 0, completionTokens: 0 },
				providerMetadata: {
					deterministic: {
						note: "Returned static fallback script.",
					},
				},
				rawCall: {
					rawPrompt: null,
					rawSettings: {},
				},
				rawResponse: undefined,
			};
		},
		doStream: async (_options: LanguageModelV1CallOptions) => {
			return {
				stream: createFallbackStream(payload),
				rawCall: {
					rawPrompt: null,
					rawSettings: {},
				},
				rawResponse: undefined,
			};
		},
	};
};

export const createScraperModel = (): MastraLanguageModel => {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return createDeterministicModel();
	}

	const openai = createOpenAI({ apiKey });
	return openai("gpt-4o-mini");
};

export { createDeterministicModel };
