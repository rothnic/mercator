import { MessageList } from "@mastra/core/agent";
import type {
	MastraMessageV2,
	UIMessageWithMetadata,
} from "@mastra/core/agent";
import { MastraMemory } from "@mastra/core/memory";
import type {
	MastraMessageV1,
	MemoryConfig,
	StorageThreadType,
	WorkingMemoryTemplate,
} from "@mastra/core/memory";
import type {
	PaginationInfo,
	StorageGetMessagesArg,
	ThreadSortOptions,
} from "@mastra/core/storage";

import type {
	DomainKnowledgeResource,
	PersistedThreadDetails,
} from "../resources/domain-knowledge.resource";
import type { DomainThread, DomainThreadMessage } from "./domain-knowledge";

const DEFAULT_MEMORY_NAME = "domain-knowledge-memory";

type AiV4CoreMessages = ReturnType<MessageList["get"]["all"]["aiV4"]["core"]>;

const toStorageThread = (
	thread: PersistedThreadDetails,
): StorageThreadType => ({
	id: thread.id,
	title: thread.title,
	resourceId: thread.resourceId,
	createdAt: new Date(thread.createdAt),
	updatedAt: new Date(thread.updatedAt),
	metadata: thread.metadata,
});

const toDomainThread = (
	thread: StorageThreadType,
	messages: DomainThreadMessage[] = [],
): DomainThread => ({
	id: thread.id,
	resourceId: thread.resourceId,
	title: thread.title,
	createdAt: thread.createdAt.toISOString(),
	updatedAt: thread.updatedAt.toISOString(),
	metadata: thread.metadata,
	messages,
});

const fromPersistedThread = (thread: PersistedThreadDetails): DomainThread => ({
	id: thread.id,
	resourceId: thread.resourceId,
	title: thread.title,
	createdAt: thread.createdAt,
	updatedAt: thread.updatedAt,
	metadata: thread.metadata,
	messages: thread.messages.map((message) => ({ ...message })),
});

const toPersistedMessage = (message: MastraMessageV1): DomainThreadMessage => ({
	id: message.id,
	role: message.role,
	type: message.type,
	content: message.content,
	createdAt: message.createdAt.toISOString(),
	toolCallArgs: message.toolCallArgs,
	toolCallIds: message.toolCallIds,
	toolNames: message.toolNames,
});

const toMastraMessage = (
	thread: PersistedThreadDetails,
	message: DomainThreadMessage,
): MastraMessageV1 => ({
	id: message.id,
	role: message.role,
	type: message.type,
	content: message.content,
	createdAt: new Date(message.createdAt),
	threadId: thread.id,
	resourceId: thread.resourceId,
	toolCallArgs: message.toolCallArgs,
	toolCallIds: message.toolCallIds,
	toolNames: message.toolNames,
});

const sortThreads = (
	threads: readonly PersistedThreadDetails[],
	options?: ThreadSortOptions,
) => {
	const orderBy = options?.orderBy ?? "updatedAt";
	const direction = options?.sortDirection ?? "DESC";
	const factor = direction === "ASC" ? 1 : -1;
	return [...threads].sort((a, b) => {
		const left = orderBy === "createdAt" ? a.createdAt : a.updatedAt;
		const right = orderBy === "createdAt" ? b.createdAt : b.updatedAt;
		return left.localeCompare(right) * factor;
	});
};

const inferResourceId = (threadId: string, fallback?: string) => {
	if (fallback) {
		return fallback;
	}
	const separatorIndex = threadId.indexOf(":");
	if (separatorIndex <= 0) {
		return threadId;
	}
	return threadId.slice(0, separatorIndex);
};

export class DomainKnowledgeMemory extends MastraMemory {
	private readonly resourceIndex = new Set<string>();

	constructor(private readonly resource: DomainKnowledgeResource) {
		super({ name: DEFAULT_MEMORY_NAME, options: { lastMessages: 10 } });
	}

	private async loadThread(threadId: string, resourceId?: string) {
		const resolvedResource = inferResourceId(threadId, resourceId);
		this.resourceIndex.add(resolvedResource);
		const thread = await this.resource.loadThread(resolvedResource, threadId);
		return thread;
	}

	private toMessageList(thread: PersistedThreadDetails) {
		const list = new MessageList({
			threadId: thread.id,
			resourceId: thread.resourceId,
		});
		if (thread.messages.length > 0) {
			list.add(
				thread.messages.map((message) => toMastraMessage(thread, message)),
				"memory",
			);
		}
		return list;
	}

	async rememberMessages({
		threadId,
		resourceId,
	}: {
		threadId: string;
		resourceId?: string;
		vectorMessageSearch?: string;
		config?: MemoryConfig;
	}): Promise<{ messages: MastraMessageV1[]; messagesV2: MastraMessageV2[] }> {
		const thread = await this.loadThread(threadId, resourceId);
		if (!thread) {
			return { messages: [], messagesV2: [] };
		}
		const list = this.toMessageList(thread);
		return {
			messages: list.get.all.v1(),
			messagesV2: list.get.all.v2(),
		} satisfies { messages: MastraMessageV1[]; messagesV2: MastraMessageV2[] };
	}

	async getThreadById({
		threadId,
	}: { threadId: string }): Promise<StorageThreadType | null> {
		const thread = await this.loadThread(threadId);
		return thread ? toStorageThread(thread) : null;
	}

	async getThreadsByResourceId({
		resourceId,
		orderBy,
		sortDirection,
	}: {
		resourceId: string;
	} & ThreadSortOptions): Promise<StorageThreadType[]> {
		const threads = await this.resource.listThreads(resourceId);
		return sortThreads(threads, { orderBy, sortDirection }).map(
			toStorageThread,
		);
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
	} & ThreadSortOptions): Promise<
		PaginationInfo & { threads: StorageThreadType[] }
	> {
		const threads = await this.getThreadsByResourceId({
			resourceId,
			orderBy,
			sortDirection,
		});
		const start = (page - 1) * perPage;
		const end = start + perPage;
		const slice = threads.slice(start, end);
		return {
			threads: slice,
			page,
			perPage,
			total: threads.length,
			hasMore: end < threads.length,
		} satisfies PaginationInfo & { threads: StorageThreadType[] };
	}

	async saveThread({
		thread,
	}: {
		thread: StorageThreadType;
		memoryConfig?: MemoryConfig;
	}): Promise<StorageThreadType> {
		this.resourceIndex.add(thread.resourceId);
		const existing = await this.resource.loadThread(
			thread.resourceId,
			thread.id,
		);
		const domainThread = toDomainThread(
			thread,
			existing ? existing.messages.map((message) => ({ ...message })) : [],
		);
		const saved = await this.resource.saveThread(domainThread);
		return toStorageThread(saved);
	}

	async saveMessages({
		messages,
		format,
		memoryConfig,
	}: {
		messages:
			| (MastraMessageV1 | MastraMessageV2)[]
			| MastraMessageV1[]
			| MastraMessageV2[];
		memoryConfig?: MemoryConfig | undefined;
		format?: "v1";
	}): Promise<MastraMessageV1[]>;
	async saveMessages({
		messages,
		format,
		memoryConfig,
	}: {
		messages:
			| (MastraMessageV1 | MastraMessageV2)[]
			| MastraMessageV1[]
			| MastraMessageV2[];
		memoryConfig?: MemoryConfig | undefined;
		format: "v2";
	}): Promise<MastraMessageV2[]>;
	async saveMessages({
		messages,
		format = "v1",
		memoryConfig,
	}: {
		messages:
			| (MastraMessageV1 | MastraMessageV2)[]
			| MastraMessageV1[]
			| MastraMessageV2[];
		memoryConfig?: MemoryConfig | undefined;
		format?: "v1" | "v2";
	}): Promise<MastraMessageV1[] | MastraMessageV2[]> {
		void memoryConfig;
		if (messages.length === 0) {
			return [] as MastraMessageV1[];
		}
		const list = new MessageList();
		list.add(messages, "memory");
		const normalized = list.get.all.v1();
		const threadId = normalized[0]?.threadId;
		const resourceId = normalized[0]?.resourceId;
		if (!threadId || !resourceId) {
			throw new Error("Memory messages must include threadId and resourceId");
		}
		this.resourceIndex.add(resourceId);
		await this.resource.appendThreadMessages({
			resourceId,
			threadId,
			messages: normalized.map(toPersistedMessage),
		});
		if (format === "v2") {
			const persisted = await this.loadThread(threadId, resourceId);
			if (!persisted) {
				return [] as MastraMessageV2[];
			}
			return this.toMessageList(persisted).get.all.v2();
		}
		return normalized;
	}

	async query({ threadId, resourceId }: StorageGetMessagesArg): Promise<{
		messages: AiV4CoreMessages;
		uiMessages: UIMessageWithMetadata[];
	}> {
		const thread = await this.loadThread(threadId, resourceId);
		if (!thread) {
			return { messages: [], uiMessages: [] };
		}
		const list = this.toMessageList(thread);
		return {
			messages: list.get.all.aiV4.core(),
			uiMessages: list.get.all.aiV4.ui(),
		};
	}

	async getWorkingMemory({
		threadId,
		resourceId,
		memoryConfig,
	}: {
		threadId: string;
		resourceId?: string;
		memoryConfig?: MemoryConfig;
	}): Promise<string | null> {
		void threadId;
		void resourceId;
		void memoryConfig;
		return null;
	}

	async getWorkingMemoryTemplate({
		memoryConfig,
	}: {
		memoryConfig?: MemoryConfig;
	} = {}): Promise<WorkingMemoryTemplate | null> {
		void memoryConfig;
		return null;
	}

	async updateWorkingMemory({
		threadId,
		resourceId,
		workingMemory,
		memoryConfig,
	}: {
		threadId: string;
		resourceId?: string;
		workingMemory: string;
		memoryConfig?: MemoryConfig;
	}): Promise<void> {
		void threadId;
		void resourceId;
		void workingMemory;
		void memoryConfig;
	}

	async __experimental_updateWorkingMemoryVNext({
		threadId,
		resourceId,
		workingMemory,
		searchString,
		memoryConfig,
	}: {
		threadId: string;
		resourceId?: string;
		workingMemory: string;
		searchString?: string;
		memoryConfig?: MemoryConfig;
	}): Promise<{ success: boolean; reason: string }> {
		void threadId;
		void resourceId;
		void workingMemory;
		void searchString;
		void memoryConfig;
		return { success: false, reason: "Working memory is not implemented." };
	}

	async deleteMessages(messageIds: string[]): Promise<void> {
		if (messageIds.length === 0) {
			return;
		}
		const ids = new Set(messageIds);
		await Promise.all(
			[...this.resourceIndex].map(async (resourceId) => {
				const threads = await this.resource.listThreads(resourceId);
				for (const persisted of threads) {
					const remaining = persisted.messages.filter(
						(message) => !ids.has(message.id),
					);
					if (remaining.length === persisted.messages.length) {
						continue;
					}
					const domainThread = fromPersistedThread(persisted);
					domainThread.messages = remaining.map((message) => ({ ...message }));
					domainThread.updatedAt = new Date().toISOString();
					await this.resource.saveThread(domainThread);
				}
			}),
		);
	}

	async deleteThread(threadId: string): Promise<void> {
		const resourceId = inferResourceId(threadId);
		await this.resource.deleteThread(resourceId, threadId);
	}
}
