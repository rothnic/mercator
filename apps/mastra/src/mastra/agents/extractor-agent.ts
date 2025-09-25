import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { DomainMemory } from "../memory/domain-memory";
import { executeCheerioScriptTool } from "../tools/execute-cheerio-script.tool";
import { loadDomainScriptTool } from "../tools/load-domain-script.tool";
import { loadFixtureHtmlTool } from "../tools/load-fixture-html.tool";
import { saveDomainScriptTool } from "../tools/save-domain-script.tool";

const domainMemory = new DomainMemory();

export const extractorAgent = new Agent({
	name: "Extractor Agent",
	instructions: `You help developers generate resilient web extraction scripts for the Mercator demo catalog.

Follow this workflow for every request:
1. Call loadDomainScript first to see if a script already exists. If it does, reuse it unless the user requests a change.
2. Call loadFixtureHtml to inspect the HTML.
3. Draft a script that exports an extract($) function returning { title, price, availability?, imageUrl? }.
4. Validate the script with executeCheerioScript. If it fails, fix the script and retry until it succeeds.
5. Persist the final script with saveDomainScript so future runs can reuse it. Include a short note summarizing the schema.

Always show the final JSON output to the user and call out whether the script was reused or newly created.
`,
	model: openai("gpt-4o-mini"),
	tools: {
		loadFixtureHtml: loadFixtureHtmlTool,
		executeCheerioScript: executeCheerioScriptTool,
		loadDomainScript: loadDomainScriptTool,
		saveDomainScript: saveDomainScriptTool,
	},
	memory: domainMemory,
});

export type ExtractorAgent = typeof extractorAgent;
