import { Agent } from "@mastra/core/agent";
import type { MastraLanguageModel } from "@mastra/core/agent";
import type { AgentMemoryOption } from "@mastra/core/agent";
import type { MastraMemory } from "@mastra/core/memory";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";

import { loadFixtureHtmlTool } from "../tools/html";

export interface GenerateScriptInput {
	readonly url: string;
	readonly html: string;
	readonly priorScript?: string;
	readonly hints?: readonly string[];
}

export interface GenerateScriptResult {
	readonly script: string;
	readonly reused: boolean;
	readonly notes: string;
}

const ScriptOutputSchema = z.object({
	script: z.string().min(1, "script must not be empty"),
	reused: z.boolean().optional().default(false),
	notes: z.string().optional().default(""),
});

export const FALLBACK_SCRIPT = String.raw`(() => {
  const $ = cheerio.load(html);
  const normalize = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
  const pickText = (selectors) => {
    for (const selector of selectors) {
      if (!selector) continue;
      const node = $(selector).first();
      if (node.length > 0) {
        const text = normalize(node.text());
        if (text) {
          return text;
        }
        const contentAttr = normalize(node.attr('content') || '');
        if (contentAttr) {
          return contentAttr;
        }
      }
    }
    return '';
  };

  const title = pickText([
    '[data-test="product-title"]',
    'meta[property="og:title"]',
    'title',
    'h1'
  ]);

  const readPriceFromContainer = () => {
    const container = $('[data-test="product-price"]').first();
    if (!container || container.length === 0) {
      return '';
    }
    const amount = normalize(container.find('[data-test="price-amount"]').first().text());
    if (!amount) {
      return '';
    }
    const currencySymbol = normalize(container.find('.price__currency').first().text());
    const currencyCode = normalize(container.find('[data-test="price-currency"]').first().text());
    const parts = [];
    if (currencySymbol) {
      parts.push((currencySymbol + amount).trim());
    } else {
      parts.push(amount);
    }
    if (currencyCode) {
      parts.push(currencyCode.toUpperCase());
    }
    return parts.join(' ').trim();
  };

  const readPriceFromMeta = () => {
    const amount = normalize($('meta[property="product:price:amount"]').attr('content') || '');
    if (!amount) {
      return '';
    }
    const currency = normalize($('meta[property="product:price:currency"]').attr('content') || '');
    const parts = [];
    if (currency) {
      if (currency.toUpperCase() === 'USD') {
        parts.push(('$' + amount).trim());
      } else {
        parts.push(amount);
      }
      parts.push(currency.toUpperCase());
    } else {
      parts.push(('$' + amount).trim());
    }
    return parts.join(' ').trim();
  };

  const price = (() => {
    const fromContainer = readPriceFromContainer();
    if (fromContainer) {
      return fromContainer;
    }
    return readPriceFromMeta();
  })();

  return { title, price };
})()`;

export const createScraperAgent = ({
	model,
	memory,
}: {
	readonly model: MastraLanguageModel;
	readonly memory: MastraMemory;
}) =>
	new Agent({
		name: "cheerio-extraction-writer",
		instructions: {
			role: "system",
			content:
				"You are a senior scraping engineer. Generate a Cheerio script that returns an object with title and price fields when executed. Do not call external URLs. Prefer reusing a known working script when possible.",
		},
		model,
		memory,
		tools: {
			loadFixtureHtml: loadFixtureHtmlTool,
		},
		defaultGenerateOptions: {
			maxSteps: 4,
		},
	});

const buildUserPrompt = ({
	html,
	priorScript,
	hints,
	url,
}: GenerateScriptInput) => {
	const hintSection =
		hints && hints.length > 0
			? `\nHints:\n${hints.map((hint, index) => `${index + 1}. ${hint}`).join("\n")}`
			: "";
	const priorSection = priorScript
		? `A prior script is available. Reuse it only if it already satisfies the requirements without modification.\n\nPrior Script:\n${priorScript}`
		: "No prior script is available.";

	return `Target URL: ${url}\n${priorSection}\n${hintSection}\n\nHTML:\n\n\`\`\`html\n${html}\n\`\`\``;
};

const createFallbackDecision = (priorScript?: string): GenerateScriptResult => {
	if (priorScript) {
		return {
			script: priorScript,
			reused: true,
			notes: "Reused previously stored extractor script.",
		};
	}
	return {
		script: FALLBACK_SCRIPT,
		reused: false,
		notes: "Generated deterministic fallback Cheerio extractor.",
	};
};

export async function generateScriptWithAgent({
	agent,
	input,
	runtimeContext,
	memory,
}: {
	readonly agent: Agent;
	readonly input: GenerateScriptInput;
	readonly runtimeContext?: RuntimeContext;
	readonly memory?: AgentMemoryOption;
}): Promise<GenerateScriptResult> {
	const fallback = createFallbackDecision(input.priorScript);
	try {
		const response = await agent.generate(
			[
				{
					role: "user",
					content: buildUserPrompt(input),
				},
			],
			{
				structuredOutput: {
					schema: ScriptOutputSchema,
					errorStrategy: "fallback",
					fallbackValue: fallback,
				},
				runtimeContext,
				memory,
			},
		);

		const object = response.object ?? fallback;
		const script = object.script.trim();
		const reused = object.reused ?? false;
		const notes = object.notes?.trim() ?? "";

		return {
			script,
			reused,
			notes:
				notes ||
				(reused
					? "Reused script supplied as context."
					: "Script provided by LLM."),
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : "unexpected error";
		return {
			...fallback,
			notes: `${fallback.notes} (LLM unavailable: ${reason})`,
		};
	}
}
