import type { Page } from "playwright-core";

export const TOOL_VERSION = "portal-details/0.2.0";

export type ToolInput = {
	recordId: string;
	maxPages?: number;
	maxRecords?: number;
	timeoutMs?: number;
};

export type RecordDetails = {
	id: string;
	title: string;
	amount: string;
	currency: string;
};

export type ToolResult = {
	status: "ok" | "not_found" | "partial" | "failed" | "unsupported";
	record: RecordDetails | null;
	coverage: { ids: string[]; complete: boolean; stopReason: string };
	receipt: { toolVersion: string; modelCalls: 0 };
};

export function validateInput(input: ToolInput) {
	if (
		!input ||
		typeof input.recordId !== "string" ||
		!/^[A-Z0-9-]{1,40}$/.test(input.recordId)
	) {
		throw new TypeError(
			"recordId must be a nonempty uppercase record identifier",
		);
	}
	const maxPages = input.maxPages ?? 5;
	const maxRecords = input.maxRecords ?? 100;
	const timeoutMs = input.timeoutMs ?? 5000;
	const limits: [string, number, number][] = [
		["maxPages", maxPages, 100],
		["maxRecords", maxRecords, 1000],
		["timeoutMs", timeoutMs, 60000],
	];
	for (const [name, value, ceiling] of limits) {
		if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) {
			throw new TypeError(
				`${name} must be an integer between 1 and ${ceiling}`,
			);
		}
	}
	return { maxPages, maxRecords, timeoutMs };
}

/** Site-specific pilot: the caller owns navigation, account scope, and the page. */
export async function getRecordDetails(
	page: Page,
	input: ToolInput,
): Promise<ToolResult> {
	const { maxPages, maxRecords, timeoutMs } = validateInput(input);

	const deadline = Date.now() + timeoutMs;
	const remaining = () => {
		const left = deadline - Date.now();
		if (left <= 0) throw new Error("execution deadline reached");
		return left;
	};
	const ids = new Set<string>();
	let complete = false;
	const result = (
		status: ToolResult["status"],
		stopReason: string,
		record: RecordDetails | null = null,
	): ToolResult => ({
		status,
		record,
		coverage: { ids: [...ids], complete, stopReason },
		receipt: { toolVersion: TOOL_VERSION, modelCalls: 0 },
	});

	try {
		const target = new URL(page.url());
		if (
			target.protocol !== "http:" ||
			!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
			target.pathname !== "/fixture"
		) {
			return result("unsupported", "unsupported_target");
		}
		await page
			.getByRole("heading", { name: "Mercator pilot portal", exact: true })
			.waitFor({
				state: "visible",
				timeout: remaining(),
			});
		const list = page.getByRole("list", { name: "Records", exact: true });
		for (let pass = 0; pass < maxPages; pass += 1) {
			await page
				.locator('[role="list"][aria-label="Records"][aria-busy="false"]')
				.waitFor({
					state: "visible",
					timeout: remaining(),
				});
			const state = await list.evaluate((element) => ({
				cursor: element.getAttribute("data-cursor"),
				complete: element.getAttribute("data-complete") === "true",
			}));
			const cursor = Number(state.cursor);
			remaining();
			if (
				!state.cursor ||
				!/^\d+$/.test(state.cursor) ||
				!Number.isSafeInteger(cursor) ||
				cursor < 0 ||
				cursor === Number.MAX_SAFE_INTEGER
			) {
				return result("failed", "unsupported_list_state");
			}
			const visibleIds = await list
				.getByRole("listitem")
				.evaluateAll((rows) =>
					rows.map((row) => row.getAttribute("data-record-id")),
				);
			remaining();
			for (const id of visibleIds) {
				if (!id || !/^[A-Z0-9-]{1,40}$/.test(id))
					return result("failed", "invalid_row_identity");
				if (!ids.has(id) && ids.size === maxRecords)
					return result("partial", "record_limit");
				ids.add(id);
				if (id !== input.recordId) continue;
				const row = list.locator(`[data-record-id="${input.recordId}"]`);
				await row
					.getByRole("button", {
						name: /^(View details|Inspect record)$/,
						exact: true,
					})
					.click({ timeout: remaining() });
				const panel = page.locator(
					`[role="dialog"][data-record-id="${input.recordId}"][aria-busy="false"]`,
				);
				await panel.waitFor({ state: "visible", timeout: remaining() });
				const record = await panel.evaluate((element) => {
					const read = (name: string) =>
						element
							.querySelector(`[data-field="${name}"]`)
							?.textContent?.trim() ?? "";
					return {
						id: read("id"),
						title: read("title"),
						amount: read("amount"),
						currency: read("currency"),
					};
				});
				remaining();
				if (
					record.id !== input.recordId ||
					!record.title ||
					!/^\d+\.\d{2}$/.test(record.amount) ||
					!/^[A-Z]{3}$/.test(record.currency)
				) {
					return result("failed", "invalid_detail_identity_or_fields");
				}
				return result("ok", "requested_record_loaded", record);
			}
			if (state.complete) {
				complete = true;
				return result("not_found", "declared_end");
			}
			if (pass + 1 === maxPages) return result("partial", "page_limit");
			await list.press("End", { timeout: remaining() });
			await page
				.locator(
					`[role="list"][data-cursor="${cursor + 1}"][aria-busy="false"]`,
				)
				.waitFor({
					state: "visible",
					timeout: remaining(),
				});
		}
		return result("partial", "page_limit");
	} catch {
		return result("failed", "timeout_or_changed_page");
	}
}
