import { checkCase, type AcceptanceCase } from "./acceptance";
import type { ToolResult } from "./tool";

/** Capture a rejected or hung candidate so later cases and evidence still run. */
export async function runCase(
	test: AcceptanceCase,
	run: () => Promise<ToolResult>,
	timeoutMs = (test.input.timeoutMs ?? 5000) + 3000,
) {
	const started = performance.now();
	let deadline: ReturnType<typeof setTimeout> | undefined;
	let output: ToolResult | undefined;
	try {
		output = await Promise.race([
			Promise.resolve().then(run),
			new Promise<never>((_, reject) => {
				deadline = setTimeout(
					() => reject(new Error("case deadline exceeded")),
					timeoutMs,
				);
			}),
		]);
		checkCase(test, output);
		return {
			case: test.name,
			passed: true,
			elapsedMs: Math.round(performance.now() - started),
			output,
		};
	} catch (error) {
		return {
			case: test.name,
			passed: false,
			elapsedMs: Math.round(performance.now() - started),
			output,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		clearTimeout(deadline);
	}
}
