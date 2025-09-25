import { promises as fs } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MastraMessageV2 } from "@mastra/core/memory";

import { DomainMemory } from "./domain-memory";

const memoryFile = path.join(process.cwd(), "apps/mastra/.runtime/memory.json");

async function cleanup(): Promise<void> {
	await fs.rm(memoryFile, { force: true });
}

describe("DomainMemory", () => {
	it("stores and retrieves messages for a thread", async () => {
		await cleanup();
		const memory = new DomainMemory();
		const threadId = "thread-1";
		const resourceId = "example.test";

		await memory.saveThread({
			thread: {
				id: threadId,
				resourceId,
				title: "Example",
				metadata: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const message: MastraMessageV2 = {
			id: "message-1",
			role: "user",
			threadId,
			resourceId,
			createdAt: new Date(),
			content: {
				format: 2,
				parts: [{ type: "text", text: "Hello" }],
			},
		};

		await memory.saveMessages({
			messages: [message],
			format: "v2",
		});

		const remembered = await memory.rememberMessages({ threadId });
		expect(remembered.messages).toHaveLength(1);
		expect(remembered.messages[0].content).toContain("Hello");

		const query = await memory.query({ threadId });
		expect(query.messages).toHaveLength(1);
		expect(query.messages[0].role).toBe("user");

		await cleanup();
	});
});
