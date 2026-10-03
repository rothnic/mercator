import { test, expect } from "bun:test";
import { validateInput } from "./tool";
import { cases, checkCase } from "./acceptance";
import { runCase } from "./case-runner";

test("invalid record identifiers and execution budgets are rejected", () => {
	for (const input of [
		null,
		undefined,
		{},
		{ recordId: "" },
		{ recordId: 'B"]' },
		{ recordId: "B", maxPages: 0 },
		{ recordId: "B", maxRecords: Number.NaN },
		{ recordId: "B", timeoutMs: 60001 },
	]) {
		expect(() => Reflect.apply(validateInput, undefined, [input])).toThrow(
			TypeError,
		);
	}
});

test("independent acceptance rejects plausible wrong record", () => {
	expect(() =>
		checkCase(cases[0], {
			status: "ok",
			record: {
				id: "A",
				title: "Birch keyboard",
				amount: "42.50",
				currency: "USD",
			},
			coverage: {
				ids: ["A", "B"],
				complete: false,
				stopReason: "requested_record_loaded",
			},
			receipt: { toolVersion: "mutant", modelCalls: 0 },
		}),
	).toThrow();
});

test("rejected and hung candidates preserve failed receipts and later cases", async () => {
	const rejected = await runCase(cases[0], async () => {
		throw new Error("candidate crashed");
	});
	const hung = await runCase(cases[0], () => new Promise(() => {}), 10);
	const later = await runCase(cases[0], async () => ({
		status: "ok",
		record: cases[0].record ?? null,
		coverage: { ids: ["A", "B"], complete: false, stopReason: "loaded" },
		receipt: { toolVersion: "test", modelCalls: 0 },
	}));
	expect([rejected.passed, hung.passed, later.passed]).toEqual([
		false,
		false,
		true,
	]);
	expect(rejected.error).toBe("candidate crashed");
	expect(hung.error).toBe("case deadline exceeded");
});
