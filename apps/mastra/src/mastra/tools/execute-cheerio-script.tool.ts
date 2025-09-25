import { createTool } from "@mastra/core/tools";
import { load as loadCheerio } from "cheerio";
import { z } from "zod";

const ExecuteSchema = z.object({
	html: z.string().describe("HTML to run the script against"),
	script: z
		.string()
		.min(1, "Provide a JavaScript extraction script")
		.describe(
			"JavaScript snippet that defines an extract($) function returning the structured data",
		),
});

const ExecuteResultSchema = z.union([
	z.object({
		ok: z.literal(true),
		result: z.record(z.string(), z.unknown()),
	}),
	z.object({
		ok: z.literal(false),
		error: z.string(),
	}),
]);

function resolveExtractor(moduleExports: unknown, localExtract: unknown) {
	if (typeof moduleExports === "function") {
		return moduleExports;
	}
	if (
		moduleExports &&
		typeof moduleExports === "object" &&
		typeof (moduleExports as Record<string, unknown>).extract === "function"
	) {
		return (moduleExports as Record<string, unknown>).extract;
	}
	if (typeof localExtract === "function") {
		return localExtract;
	}
	return null;
}

function normalizeScript(source: string): string {
	return source
		.replace(
			/export\s+default\s+function\s+extract/gu,
			"extract = function extract",
		)
		.replace(/export\s+default\s+/gu, "")
		.replace(/export\s+function\s+extract/gu, "extract = function extract")
		.replace(/export\s+(const|let|var)\s+extract\s*=\s*/gu, "extract = ")
		.replace(/export\s+/gu, "");
}

export async function runCheerioExtraction({
	html,
	script,
}: {
	html: string;
	script: string;
}): Promise<z.infer<typeof ExecuteResultSchema>> {
	try {
		const executableScript = normalizeScript(script);
		const executor = new Function(
			"cheerio",
			"html",
			`const exports = {};
       const module = { exports };
       let extract = undefined;
       const $ = cheerio.load(html);
       ${executableScript}
       const resolved = (${resolveExtractor.toString()})(module.exports, extract);
       if (typeof resolved !== 'function') {
         throw new Error('The script must export an extract($) function.');
       }
       return resolved($);
      `,
		);
		const result = await Promise.resolve(
			executor({ load: loadCheerio, default: loadCheerio }, html),
		);
		return { ok: true as const, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false as const, error: message };
	}
}

export const executeCheerioScriptTool = createTool({
	id: "executeCheerioScript",
	description:
		"Execute a proposed extraction script against supplied HTML using cheerio to validate the shape of the output.",
	inputSchema: ExecuteSchema,
	outputSchema: ExecuteResultSchema,
	execute: async (context) => {
		return runCheerioExtraction(context.context);
	},
});
