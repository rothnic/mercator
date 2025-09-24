import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RuntimeContext } from "@mastra/core/runtime-context";

import { generateScriptWithAgent } from "./agent/scraper-agent";
import { appendHistoryLine } from "./history/history";
import { createMastraProject } from "./mastra/project";
import type { PersistedScriptDetails } from "./resources/domain-knowledge.resource";
import { ensureRuntimePaths, resolveRuntimePaths } from "./runtime/environment";
import { loadFixtureHtmlTool } from "./tools/html";
import { runCheerioScript } from "./utils/run-cheerio-script";
import { validateExtraction } from "./validation/validate-extraction";

export interface RunOptions {
	url: string;
	runtimeRoot?: string;
	runId?: string;
	now?: Date;
}

export interface RunResult {
	script: string;
	reused: boolean;
	raw: unknown;
	validation: ReturnType<typeof validateExtraction>;
	domainKnowledgePath: string;
	historyFile: string;
}

const createHistoryOutcome = (details: string) => details.slice(0, 120);

export async function runScraper(options: RunOptions): Promise<RunResult> {
	const runId = options.runId ?? randomUUID();
	const timestamp = options.now ?? new Date();
	const url = new URL(options.url);
	const resourceId = url.hostname;
	const resourcePath = url.pathname || "/";
	const runtimePaths = resolveRuntimePaths(options.runtimeRoot);
	await ensureRuntimePaths(runtimePaths);
	const runtimeContext = new RuntimeContext();

	let step = 0;
	const log = async (action: string, outcome: string) => {
		step += 1;
		await appendHistoryLine(runtimePaths, {
			t: new Date().toISOString(),
			runId,
			step,
			actor: "scraper",
			action,
			outcome: createHistoryOutcome(outcome),
			resourceId,
		});
	};

	await log("start", `Starting run for ${resourcePath}`);

	const project = createMastraProject({
		runtimeRoot: runtimePaths.runtimeRoot,
	});
	const agent = project.mastra.getAgent("scraper");
	const tools = await agent.getTools({ runtimeContext });
	const htmlTool = (tools?.loadFixtureHtml ?? loadFixtureHtmlTool) as {
		execute?: typeof loadFixtureHtmlTool.execute;
	};
	if (!htmlTool.execute) {
		throw new Error("loadFixtureHtml tool is not available");
	}

	const htmlResult = await htmlTool.execute(
		{
			context: { url: options.url },
			runtimeContext,
			suspend: async () => undefined,
		},
		undefined,
	);
	await log(
		"getHtml",
		htmlResult.source === "fixture"
			? `Loaded fixture ${htmlResult.fixtureId ?? "unknown"} (${htmlResult.html.length} chars)`
			: `Loaded generic HTML snippet (${htmlResult.html.length} chars)`,
	);

	const persistedScript: PersistedScriptDetails | undefined =
		await project.resources.domainKnowledge.loadScript(
			resourceId,
			resourcePath,
		);
	const threadId = `${resourceId}:${resourcePath}`;
	const priorScript = persistedScript?.script;
	const scriptDecision = persistedScript
		? {
				script: persistedScript.script,
				reused: true,
				notes: persistedScript.notes ?? "Reused stored extractor script.",
			}
		: await generateScriptWithAgent({
				agent,
				input: {
					url: options.url,
					html: htmlResult.html,
					priorScript,
				},
				runtimeContext,
				memory: {
					thread: threadId,
					resource: resourceId,
				},
			});

	await log(
		"generateScript",
		scriptDecision.reused
			? "Reused stored extractor script."
			: scriptDecision.notes || "Synthesized new Cheerio extractor script.",
	);

	const execution = runCheerioScript({
		code: scriptDecision.script,
		html: htmlResult.html,
	});
	if (execution.error) {
		await log("executeScript", `Execution failed: ${execution.error}`);
	} else {
		await log("executeScript", "Executed extractor script on HTML.");
	}

	const validation = validateExtraction(execution.raw);
	await log(
		"validate",
		validation.ok
			? `Validated extraction (title=${validation.value?.title ?? ""}, price=${validation.value?.price ?? ""}).`
			: `Validation failed: ${validation.issues.join(", ")}`,
	);

	if (!scriptDecision.reused && validation.ok) {
		await project.resources.domainKnowledge.saveScript({
			resourceId,
			path: resourcePath,
			script: scriptDecision.script,
			notes: scriptDecision.notes,
			timestamp,
		});
		await project.memory.saveMessages({
			messages: [
				{
					id: randomUUID(),
					role: "assistant",
					type: "text",
					content: `Persisted extractor for ${resourcePath}`,
					createdAt: timestamp,
					threadId,
					resourceId,
				},
			],
			format: "v1",
		});
		await log("persistScript", `Persisted script for ${resourcePath}.`);
	}

	const domainKnowledgePath =
		project.resources.domainKnowledge.resolvePath(resourceId);

	return {
		script: scriptDecision.script,
		reused: scriptDecision.reused,
		raw: execution.raw,
		validation,
		domainKnowledgePath,
		historyFile: runtimePaths.historyFile,
	};
}

const isMainModule = () => {
	if (typeof process === "undefined") {
		return false;
	}
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}
	return fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(entry));
};

const parseArguments = (argv: string[]): { url: string } => {
	const [, , maybeUrl] = argv;
	if (!maybeUrl) {
		throw new Error("Usage: pnpm --filter @mercator/service run demo <url>");
	}
	return { url: maybeUrl };
};

if (isMainModule()) {
	const { url } = parseArguments(process.argv);
	runScraper({ url })
		.then((result) => {
			const status = result.validation.ok ? "success" : "failed";
			console.info(
				`[run:${status}] title=${result.validation.value?.title ?? ""} price=${result.validation.value?.price ?? ""}`,
			);
			console.info(`history: ${result.historyFile}`);
			console.info(`domain knowledge: ${result.domainKnowledgePath}`);
			if (!result.validation.ok) {
				console.info(`issues: ${result.validation.issues.join(", ")}`);
			}
		})
		.catch((error) => {
			console.error(
				"[run:error]",
				error instanceof Error ? error.message : String(error),
			);
			process.exitCode = 1;
		});
}
