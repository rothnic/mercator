import { mkdir } from "node:fs/promises";

import {
	appendThreadMessages,
	createDomainKnowledgePath,
	createExactPathRegex,
	findMatchingScript,
	loadDomainKnowledge,
	removeThread,
	saveDomainKnowledge,
	upsertScriptEntry,
	upsertThread,
} from "../memory/domain-knowledge";
import type {
	DomainKnowledge,
	DomainThread,
	DomainThreadMessage,
} from "../memory/domain-knowledge";

export interface PersistedScriptDetails {
	readonly script: string;
	readonly notes?: string;
	readonly lastUpdatedAt: string;
}

export interface PersistedThreadDetails {
	readonly id: string;
	readonly resourceId: string;
	readonly title?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly metadata?: Record<string, unknown>;
	readonly messages: readonly DomainThreadMessage[];
}

export class DomainKnowledgeResource {
	constructor(private readonly baseDir: string) {}

	private async ensureBaseDir() {
		await mkdir(this.baseDir, { recursive: true });
	}

	async load(resourceId: string): Promise<DomainKnowledge> {
		await this.ensureBaseDir();
		return loadDomainKnowledge(this.baseDir, resourceId);
	}

	async loadScript(resourceId: string, path: string) {
		const knowledge = await this.load(resourceId);
		const script = findMatchingScript(knowledge, path);
		if (!script) {
			return undefined;
		}
		return {
			script: script.script,
			notes: script.notes,
			lastUpdatedAt: script.lastUpdatedAt,
		} satisfies PersistedScriptDetails;
	}

	async saveScript({
		resourceId,
		path,
		script,
		notes,
		timestamp,
	}: {
		readonly resourceId: string;
		readonly path: string;
		readonly script: string;
		readonly notes?: string;
		readonly timestamp: Date;
	}) {
		await this.ensureBaseDir();
		const knowledge = await this.load(resourceId);
		const updated = upsertScriptEntry(knowledge, {
			pathRegex: createExactPathRegex(path),
			script,
			notes,
			lastUpdatedAt: timestamp.toISOString(),
		});
		await saveDomainKnowledge(this.baseDir, updated);
		return updated;
	}

	async loadThread(
		resourceId: string,
		threadId: string,
	): Promise<PersistedThreadDetails | undefined> {
		const knowledge = await this.load(resourceId);
		const thread = knowledge.threads[threadId];
		if (!thread) {
			return undefined;
		}
		return { ...thread } satisfies PersistedThreadDetails;
	}

	async saveThread(thread: DomainThread): Promise<PersistedThreadDetails> {
		await this.ensureBaseDir();
		const knowledge = await this.load(thread.resourceId);
		const updated = upsertThread(knowledge, thread);
		await saveDomainKnowledge(this.baseDir, updated);
		const persisted = updated.threads[thread.id];
		if (!persisted) {
			throw new Error(`Failed to persist thread ${thread.id}`);
		}
		return { ...persisted } satisfies PersistedThreadDetails;
	}

	async listThreads(
		resourceId: string,
	): Promise<readonly PersistedThreadDetails[]> {
		const knowledge = await this.load(resourceId);
		return Object.values(knowledge.threads ?? {}).map((thread) => ({
			...thread,
		}));
	}

	async deleteThread(resourceId: string, threadId: string) {
		await this.ensureBaseDir();
		const knowledge = await this.load(resourceId);
		if (!knowledge.threads[threadId]) {
			return;
		}
		const updated = removeThread(knowledge, threadId);
		await saveDomainKnowledge(this.baseDir, updated);
	}

	async appendThreadMessages({
		resourceId,
		threadId,
		messages,
	}: {
		readonly resourceId: string;
		readonly threadId: string;
		readonly messages: readonly DomainThreadMessage[];
	}): Promise<PersistedThreadDetails> {
		await this.ensureBaseDir();
		const knowledge = await this.load(resourceId);
		const createdTimestamp = messages[0]?.createdAt;
		const updatedTimestamp = messages[messages.length - 1]?.createdAt;
		const updated = appendThreadMessages(knowledge, {
			threadId,
			resourceId,
			messages: messages.map((message) => ({ ...message })),
			timestamps: {
				created: createdTimestamp,
				updated: updatedTimestamp,
			},
		});
		await saveDomainKnowledge(this.baseDir, updated);
		const persisted = updated.threads[threadId];
		if (!persisted) {
			throw new Error(`Failed to append messages for thread ${threadId}`);
		}
		return { ...persisted } satisfies PersistedThreadDetails;
	}

	resolvePath(resourceId: string) {
		return createDomainKnowledgePath(this.baseDir, resourceId);
	}
}
