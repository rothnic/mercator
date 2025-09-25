import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { convertMessages } from "@mastra/core/agent";
import { MastraMemory } from "@mastra/core/memory";
import type {
	MastraMessageV1,
	MastraMessageV2,
	MemoryConfig,
	StorageThreadType,
	WorkingMemoryTemplate,
} from "@mastra/core/memory";
import type { CoreMessage } from "ai";

import type { UIMessageWithMetadata } from "@mastra/core/agent";
import type {
	StorageGetMessagesArg,
	ThreadSortOptions,
} from "@mastra/core/storage";

const runtimeRoot = path.join(
	fileURLToPath(new URL("../../..", import.meta.url)),
	".runtime",
);
const memoryFilePath = path.join(runtimeRoot, "memory.json");

interface PersistedThread {
	id: string;
	resourceId: string;
	title?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

interface PersistedMessage {
	id: string;
	role: "user" | "assistant" | "system";
	type?: string;
	threadId?: string;
	resourceId?: string;
	createdAt: string;
	content: MastraMessageV2["content"];
}

interface MemorySnapshot {
	threads: Record<string, PersistedThread>;
	messages: Record<string, PersistedMessage>;
}

const emptySnapshot: MemorySnapshot = { threads: {}, messages: {} };

async function ensureRuntimeDir(): Promise<void> {
	await fs.mkdir(runtimeRoot, { recursive: true });
}

async function loadSnapshot(): Promise<MemorySnapshot> {
	try {
		const raw = await fs.readFile(memoryFilePath, "utf8");
		const data = JSON.parse(raw) as MemorySnapshot;
		return {
			threads: data.threads ?? {},
			messages: data.messages ?? {},
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { ...emptySnapshot };
		}
		throw error;
	}
}

async function persistSnapshot(snapshot: MemorySnapshot): Promise<void> {
	await ensureRuntimeDir();
	await fs.writeFile(memoryFilePath, JSON.stringify(snapshot, null, 2), "utf8");
}

function hydrateThread(thread: PersistedThread): StorageThreadType {
	return {
		id: thread.id,
		resourceId: thread.resourceId,
		title: thread.title,
		metadata: thread.metadata,
		createdAt: new Date(thread.createdAt),
		updatedAt: new Date(thread.updatedAt),
	};
}

function dehydrateThread(thread: StorageThreadType): PersistedThread {
	return {
		id: thread.id,
		resourceId: thread.resourceId,
		title: thread.title,
		metadata: thread.metadata,
		createdAt: thread.createdAt.toISOString(),
		updatedAt: thread.updatedAt.toISOString(),
	};
}

function hydrateMessage(message: PersistedMessage): MastraMessageV2 {
	return {
		id: message.id,
		role: message.role,
		type: message.type,
		threadId: message.threadId,
		resourceId: message.resourceId,
		createdAt: new Date(message.createdAt),
		content: message.content,
	};
}

function dehydrateMessage(message: MastraMessageV2): PersistedMessage {
	return {
		id: message.id,
		role: message.role,
		type: message.type,
		threadId: message.threadId,
		resourceId: message.resourceId,
		createdAt: message.createdAt.toISOString(),
		content: message.content,
	};
}

function compareByCreatedAt(a: PersistedMessage, b: PersistedMessage): number {
	return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function isTextPart(
	part: MastraMessageV2["content"]["parts"][number],
): part is {
	type: "text";
	text: string;
} {
	return (
		part.type === "text" && "text" in part && typeof part.text === "string"
	);
}

function toMastraMessageV1(message: MastraMessageV2): MastraMessageV1 {
	const parts = message.content.parts ?? [];
	const textContent = parts
		.filter(isTextPart)
		.map((part) => part.text)
		.join("\n");

	return {
		id: message.id,
		role: message.role,
		content: textContent,
		createdAt: message.createdAt,
		threadId: message.threadId,
		resourceId: message.resourceId,
		type: "text",
	};
}

function paginate<T>(
	items: T[],
	page: number,
	perPage: number,
): {
	page: number;
	perPage: number;
	total: number;
	hasMore: boolean;
	items: T[];
} {
	const start = (page - 1) * perPage;
	const end = start + perPage;
	const slice = items.slice(start, end);
	return {
		page,
		perPage,
		total: items.length,
		hasMore: end < items.length,
		items: slice,
	};
}

function applySelectBy(
	messages: MastraMessageV2[],
	selectBy: StorageGetMessagesArg["selectBy"] | undefined,
): MastraMessageV2[] {
	let result = messages;

	if (typeof selectBy?.last === "number" && selectBy.last > 0) {
		result = result.slice(-selectBy.last);
	}

	if (selectBy?.pagination) {
		const page = selectBy.pagination.page ?? 1;
		const perPage = selectBy.pagination.perPage ?? (result.length || 1);
		result = paginate(result, page, perPage).items;
	}

	return result;
}

export class DomainMemory extends MastraMemory {
	constructor(name = "domain-memory") {
		super({ name });
	}

	async getWorkingMemory({
		threadId: _threadId,
		resourceId: _resourceId,
		memoryConfig: _memoryConfig,
	}: {
		threadId: string;
		resourceId?: string;
		memoryConfig?: MemoryConfig;
	}): Promise<string | null> {
		return null;
	}

	async getWorkingMemoryTemplate({
		memoryConfig: _memoryConfig,
	}: {
		memoryConfig?: MemoryConfig;
	} = {}): Promise<WorkingMemoryTemplate | null> {
		return null;
	}

	async updateWorkingMemory({
		threadId: _threadId,
		resourceId: _resourceId,
		workingMemory: _workingMemory,
		memoryConfig: _memoryConfig,
	}: {
		threadId: string;
		resourceId?: string;
		workingMemory: string;
		memoryConfig?: MemoryConfig;
	}): Promise<void> {
		return;
	}

	async __experimental_updateWorkingMemoryVNext({
		threadId: _threadId,
		resourceId: _resourceId,
		workingMemory: _workingMemory,
		searchString: _searchString,
		memoryConfig: _memoryConfig,
	}: {
		threadId: string;
		resourceId?: string;
		workingMemory: string;
		searchString?: string;
		memoryConfig?: MemoryConfig;
	}): Promise<{
		success: boolean;
		reason: string;
	}> {
		return {
			success: false,
			reason: "Working memory is not persisted in DomainMemory.",
		};
	}

	private async listMessagesForThread(
		threadId: string,
	): Promise<MastraMessageV2[]> {
		const snapshot = await loadSnapshot();
		return Object.values(snapshot.messages)
			.filter((message) => message.threadId === threadId)
			.sort(compareByCreatedAt)
			.map(hydrateMessage);
	}

	async rememberMessages({
		threadId,
	}: {
		threadId: string;
		resourceId?: string;
		vectorMessageSearch?: string;
		config?: MemoryConfig;
	}): Promise<{ messages: MastraMessageV1[]; messagesV2: MastraMessageV2[] }> {
		const messages = await this.listMessagesForThread(threadId);
		return {
			messages: messages.map(toMastraMessageV1),
			messagesV2: messages,
		};
	}

	async getThreadById({
		threadId,
	}: { threadId: string }): Promise<StorageThreadType | null> {
		const snapshot = await loadSnapshot();
		const record = snapshot.threads[threadId];
		return record ? hydrateThread(record) : null;
	}

	async getThreadsByResourceId({
		resourceId,
		orderBy = "updatedAt",
		sortDirection = "DESC",
	}: {
		resourceId: string;
	} & ThreadSortOptions): Promise<StorageThreadType[]> {
		const snapshot = await loadSnapshot();
		const threads = Object.values(snapshot.threads)
			.filter((thread) => thread.resourceId === resourceId)
			.map(hydrateThread);

		const directionMultiplier = sortDirection === "ASC" ? 1 : -1;
		return threads.sort((a, b) => {
			const left = orderBy === "createdAt" ? a.createdAt : a.updatedAt;
			const right = orderBy === "createdAt" ? b.createdAt : b.updatedAt;
			return (left.getTime() - right.getTime()) * directionMultiplier;
		});
	}

	async getThreadsByResourceIdPaginated({
		resourceId,
		page,
		perPage,
		orderBy,
		sortDirection,
	}: {
		resourceId: string;
		page: number;
		perPage: number;
	} & ThreadSortOptions): Promise<{
		page: number;
		perPage: number;
		total: number;
		hasMore: boolean;
		threads: StorageThreadType[];
	}> {
		const threads = await this.getThreadsByResourceId({
			resourceId,
			orderBy,
			sortDirection,
		});
		const slice = paginate(threads, page, perPage);
		return {
			page: slice.page,
			perPage: slice.perPage,
			total: slice.total,
			hasMore: slice.hasMore,
			threads: slice.items,
		};
	}

	async saveThread({
		thread,
		memoryConfig: _memoryConfig,
	}: {
		thread: StorageThreadType;
		memoryConfig?: MemoryConfig;
	}): Promise<StorageThreadType> {
		const snapshot = await loadSnapshot();
		snapshot.threads[thread.id] = dehydrateThread(thread);
		await persistSnapshot(snapshot);
		return thread;
	}

	async deleteThread(threadId: string): Promise<void> {
		const snapshot = await loadSnapshot();
		delete snapshot.threads[threadId];
		for (const [messageId, message] of Object.entries(snapshot.messages)) {
			if (message.threadId === threadId) {
				delete snapshot.messages[messageId];
			}
		}
		await persistSnapshot(snapshot);
	}

	async saveMessages(args: {
		messages: MastraMessageV1[];
		memoryConfig?: MemoryConfig;
		format?: "v1";
	}): Promise<MastraMessageV1[]>;

	async saveMessages(args: {
		messages: MastraMessageV2[];
		memoryConfig?: MemoryConfig;
		format: "v2";
	}): Promise<MastraMessageV2[]>;

	async saveMessages({
		messages,
		memoryConfig: _memoryConfig,
		format,
	}: {
		messages: MastraMessageV1[] | MastraMessageV2[];
		memoryConfig?: MemoryConfig;
		format?: "v1" | "v2";
	}): Promise<MastraMessageV1[] | MastraMessageV2[]> {
		const snapshot = await loadSnapshot();
		const asV2 =
			format === "v1"
				? convertMessages(messages).to("Mastra.V2")
				: (messages as MastraMessageV2[]);
		for (const message of asV2) {
			snapshot.messages[message.id] = dehydrateMessage(message);
		}
		await persistSnapshot(snapshot);
		return format === "v1" ? (messages as MastraMessageV1[]) : asV2;
	}

	async updateMessages({
		messages,
	}: {
		messages: Array<Partial<MastraMessageV2> & { id: string }>;
	}): Promise<MastraMessageV2[]> {
		const snapshot = await loadSnapshot();
		const updated: MastraMessageV2[] = [];
		for (const update of messages) {
			const existing = snapshot.messages[update.id];
			if (!existing) continue;
			const hydrated = hydrateMessage(existing);
			const merged: MastraMessageV2 = {
				...hydrated,
				...update,
				content: update.content ?? hydrated.content,
			};
			snapshot.messages[update.id] = dehydrateMessage(merged);
			updated.push(merged);
		}
		await persistSnapshot(snapshot);
		return updated;
	}

	async getMessages({
		threadId,
		format = "v2",
		selectBy,
	}: StorageGetMessagesArg): Promise<MastraMessageV1[] | MastraMessageV2[]> {
		let messages = await this.listMessagesForThread(threadId);
		messages = applySelectBy(messages, selectBy);
		if (format === "v1") {
			return messages.map(toMastraMessageV1);
		}
		return messages;
	}

	async getMessagesById({
		messageIds,
		format = "v2",
	}: {
		messageIds: string[];
		format?: "v1" | "v2";
	}): Promise<MastraMessageV1[] | MastraMessageV2[]> {
		const snapshot = await loadSnapshot();
		const messages = messageIds
			.map((id) => snapshot.messages[id])
			.filter((value): value is PersistedMessage => Boolean(value))
			.sort(compareByCreatedAt)
			.map(hydrateMessage);
		if (format === "v1") {
			return messages.map(toMastraMessageV1);
		}
		return messages;
	}

	async deleteMessages(messageIds: string[]): Promise<void> {
		const snapshot = await loadSnapshot();
		for (const id of messageIds) {
			delete snapshot.messages[id];
		}
		await persistSnapshot(snapshot);
	}

	async query({ threadId, selectBy }: StorageGetMessagesArg): Promise<{
		messages: CoreMessage[];
		uiMessages: UIMessageWithMetadata[];
	}> {
		let messages = await this.listMessagesForThread(threadId);
		messages = applySelectBy(messages, selectBy);
		return {
			messages: convertMessages(messages).to("AIV4.Core"),
			uiMessages: convertMessages(messages).to(
				"AIV4.UI",
			) as UIMessageWithMetadata[],
		};
	}
}
