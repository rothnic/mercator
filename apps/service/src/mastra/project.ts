import { Mastra, createMastraProxy } from "@mastra/core";
import type { Agent } from "@mastra/core/agent";

import { createScraperAgent } from "../agent/scraper-agent";
import { DomainKnowledgeMemory } from "../memory/domain-knowledge.memory";
import { DomainKnowledgeResource } from "../resources/domain-knowledge.resource";
import { resolveRuntimePaths } from "../runtime/environment";
import { createScraperModel } from "./model/scraper-model";

export interface MastraProject {
	readonly mastra: Mastra;
	readonly agents: {
		readonly scraper: Agent;
	};
	readonly resources: {
		readonly domainKnowledge: DomainKnowledgeResource;
	};
	readonly memory: DomainKnowledgeMemory;
}

export const createMastraProject = ({
	runtimeRoot,
}: {
	readonly runtimeRoot?: string;
} = {}): MastraProject => {
	const runtimePaths = resolveRuntimePaths(runtimeRoot);
	const domainKnowledge = new DomainKnowledgeResource(
		runtimePaths.domainKnowledgeDir,
	);
	const memory = new DomainKnowledgeMemory(domainKnowledge);
	const scraperAgent = createScraperAgent({
		model: createScraperModel(),
		memory,
	});
	const mastra = new Mastra({
		agents: {
			scraper: scraperAgent,
		},
		logger: false,
	});
	return {
		mastra,
		agents: {
			scraper: scraperAgent,
		},
		resources: {
			domainKnowledge,
		},
		memory,
	};
};

const defaultProject = createMastraProject();

export const mastra = defaultProject.mastra;
const proxyLogger = defaultProject.mastra.getLogger();
export const mastraProxy = createMastraProxy({ mastra, logger: proxyLogger });
export const project = defaultProject;
