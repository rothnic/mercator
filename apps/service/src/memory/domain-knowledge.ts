import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MastraMessageV1 } from "@mastra/core/memory";

export interface DomainScriptEntry {
	pathRegex: string;
	script: string;
	lastUpdatedAt: string;
	notes?: string;
}

export interface DomainThreadMessage {
	id: string;
	role: "system" | "user" | "assistant" | "tool";
	type: "text" | "tool-call" | "tool-result";
	content: MastraMessageV1["content"];
	createdAt: string;
	toolCallIds?: string[];
	toolCallArgs?: Record<string, unknown>[];
	toolNames?: string[];
}

export interface DomainThread {
	id: string;
	resourceId: string;
	title?: string;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, unknown>;
	messages: DomainThreadMessage[];
}

export interface DomainKnowledge {
	resourceId: string;
	scripts: DomainScriptEntry[];
	threads: Record<string, DomainThread>;
}

export const createDomainKnowledgePath = (dir: string, resourceId: string) =>
	join(dir, `${resourceId}.json`);

const createDefaultKnowledge = (resourceId: string): DomainKnowledge => ({
	resourceId,
	scripts: [],
	threads: {},
});

export const loadDomainKnowledge = async (
	dir: string,
	resourceId: string,
): Promise<DomainKnowledge> => {
	const path = createDomainKnowledgePath(dir, resourceId);
	try {
		const contents = await readFile(path, "utf8");
		const parsed = JSON.parse(contents) as DomainKnowledge;
		if (!parsed.resourceId) {
			return createDefaultKnowledge(resourceId);
		}
		return {
			...parsed,
			threads: parsed.threads ?? {},
		} satisfies DomainKnowledge;
	} catch {
		return createDefaultKnowledge(resourceId);
	}
};

export const saveDomainKnowledge = async (
	dir: string,
	knowledge: DomainKnowledge,
) => {
	const path = createDomainKnowledgePath(dir, knowledge.resourceId);
	await writeFile(path, `${JSON.stringify(knowledge, null, 2)}\n`, "utf8");
};

export const upsertScriptEntry = (
	knowledge: DomainKnowledge,
	entry: DomainScriptEntry,
): DomainKnowledge => {
	const existingIndex = knowledge.scripts.findIndex(
		(candidate) => candidate.pathRegex === entry.pathRegex,
	);
	if (existingIndex >= 0) {
		const nextScripts = [...knowledge.scripts];
		nextScripts[existingIndex] = entry;
		return {
			...knowledge,
			scripts: nextScripts,
		};
	}

	return {
		...knowledge,
		scripts: [...knowledge.scripts, entry],
	};
};

export const findMatchingScript = (
	knowledge: DomainKnowledge,
	path: string,
): DomainScriptEntry | undefined => {
	for (const candidate of knowledge.scripts) {
		try {
			const pattern = new RegExp(candidate.pathRegex);
			if (pattern.test(path)) {
				return candidate;
			}
		} catch {
			// Invalid regex, skip this candidate
		}
	}
	return undefined;
};

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createExactPathRegex = (path: string) => `^${escapeRegExp(path)}$`;

const ensureThreads = (knowledge: DomainKnowledge) => {
	if (!knowledge.threads) {
		knowledge.threads = {};
	}
	return knowledge.threads;
};

export const upsertThread = (
	knowledge: DomainKnowledge,
	thread: DomainThread,
): DomainKnowledge => {
	const threads = { ...ensureThreads(knowledge), [thread.id]: thread };
	return {
		...knowledge,
		threads,
	};
};

export const removeThread = (
	knowledge: DomainKnowledge,
	threadId: string,
): DomainKnowledge => {
	const threads = { ...ensureThreads(knowledge) };
	delete threads[threadId];
	return {
		...knowledge,
		threads,
	};
};

export const appendThreadMessages = (
	knowledge: DomainKnowledge,
	{
		threadId,
		resourceId,
		messages,
		timestamps,
	}: {
		readonly threadId: string;
		readonly resourceId: string;
		readonly messages: DomainThreadMessage[];
		readonly timestamps: {
			readonly created?: string;
			readonly updated?: string;
		};
	},
): DomainKnowledge => {
	const threads = ensureThreads(knowledge);
	const existing = threads[threadId];
	const createdAt =
		existing?.createdAt ?? timestamps.created ?? new Date().toISOString();
	const updatedAt = timestamps.updated ?? new Date().toISOString();
	const nextMessages = existing
		? [...existing.messages, ...messages]
		: [...messages];
	return upsertThread(knowledge, {
		id: threadId,
		resourceId,
		title: existing?.title,
		createdAt,
		updatedAt,
		metadata: existing?.metadata,
		messages: nextMessages,
	});
};
