import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type WorkerStatus =
	| "candidate_available"
	| "invalid_result"
	| "auth_required"
	| "configuration_error"
	| "deadline_exceeded"
	| "worker_failed";

function validBuildResult(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const fields = ["summary", "changed_files", "checks_run", "remaining_limits"];
	if (Object.keys(value).length !== fields.length) return false;
	return fields.every((field) => {
		if (!Object.hasOwn(value, field)) return false;
		const entry = Reflect.get(value, field);
		return field === "summary"
			? typeof entry === "string"
			: Array.isArray(entry) && entry.every((item) => typeof item === "string");
	});
}

async function runCodex(
	args: string[],
	directory: string,
	timeoutMs: number,
	input = "",
) {
	const child = spawn("codex", args, {
		cwd: directory,
		stdio: ["pipe", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	let timedOut = false;
	let outputClosed = false;
	let drain: ReturnType<typeof setTimeout> | undefined;
	let hardStop: ReturnType<typeof setTimeout> | undefined;
	child.stdout.on("data", (data) => {
		stdout += data;
	});
	child.stderr.on("data", (data) => {
		stderr += data;
	});
	child.stdin.on("error", () => {}); // Early worker exit is classified by its exit/error event.
	child.stdin.end(input);
	const deadline = setTimeout(() => {
		timedOut = true;
		child.kill("SIGTERM");
	}, timeoutMs);
	try {
		const exitCode = await new Promise<number | null>((resolveExit, reject) => {
			child.once("error", reject);
			child.once("close", (code) => {
				outputClosed = true;
				resolveExit(code);
			});
			child.once("exit", (code) => {
				// Descendants can retain inherited pipes after the direct child exits.
				drain = setTimeout(() => resolveExit(code), 250);
			});
			hardStop = setTimeout(() => {
				timedOut = true;
				child.kill("SIGKILL");
				resolveExit(child.exitCode);
			}, timeoutMs + 1000);
		});
		return { stdout, stderr, exitCode, timedOut, outputClosed };
	} finally {
		clearTimeout(deadline);
		clearTimeout(drain);
		clearTimeout(hardStop);
		child.stdin.destroy();
		child.stdout.destroy();
		child.stderr.destroy();
		child.unref();
	}
}

// One bounded native Codex attempt. Scheduling and promotion stay outside this script.
export async function runWorker(
	directory = import.meta.dir,
	timeoutMs = 600000,
) {
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) {
		throw new TypeError(
			"Worker timeout must be an integer from 1 to 600000 ms",
		);
	}
	const started = Date.now();
	await mkdir(join(directory, "results"), { recursive: true });
	const jobDir = await mkdtemp(join(directory, "results", "job-"));
	const finish = async (
		status: WorkerStatus,
		exitCode: number | null,
		reason?: string,
	) => {
		const receipt = {
			status,
			exitCode,
			jobDir,
			authentication: "chatgpt",
			timeoutMs,
			startedAt: new Date(started).toISOString(),
			finishedAt: new Date().toISOString(),
			...(reason ? { reason } : {}),
		};
		await writeFile(
			join(jobDir, "worker-receipt.json"),
			`${JSON.stringify(receipt, null, 2)}\n`,
		);
		return receipt;
	};
	if (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY) {
		return finish(
			"configuration_error",
			null,
			"API-key overrides are refused; use ChatGPT-authenticated Codex",
		);
	}
	try {
		const authRemaining = timeoutMs - (Date.now() - started);
		if (authRemaining <= 0) return finish("deadline_exceeded", null);
		const auth = await runCodex(
			["login", "status"],
			directory,
			Math.min(30000, authRemaining),
		);
		await writeFile(
			join(jobDir, "auth-status.txt"),
			`${auth.stdout}${auth.stderr}`,
		);
		if (auth.timedOut || Date.now() - started >= timeoutMs)
			return finish(
				"deadline_exceeded",
				auth.exitCode,
				"Authentication preflight exceeded its time budget",
			);
		if (
			auth.exitCode !== 0 ||
			!auth.outputClosed ||
			!`${auth.stdout}${auth.stderr}`.includes("Logged in using ChatGPT")
		) {
			return finish(
				"auth_required",
				auth.exitCode,
				"ChatGPT login preflight failed; run codex login on the owning worker",
			);
		}
		const task = await readFile(join(directory, "BUILD_TASK.md"), "utf8");
		const schemaPath = resolve(directory, "build-result.schema.json");
		const taskSha256 = createHash("sha256").update(task).digest("hex");
		await writeFile(
			join(jobDir, "input.json"),
			`${JSON.stringify({ taskSha256, schemaPath }, null, 2)}\n`,
		);
		const remaining = timeoutMs - (Date.now() - started);
		if (remaining <= 0) return finish("deadline_exceeded", null);
		const args = [
			"exec",
			"--ignore-user-config",
			"--sandbox",
			"workspace-write",
			"-c",
			'approval_policy="never"',
			"--json",
			"--output-schema",
			schemaPath,
			"--output-last-message",
			join(jobDir, "build-result.json"),
			...(process.env.MERCATOR_MODEL
				? ["--model", process.env.MERCATOR_MODEL]
				: []),
			"-",
		];
		const build = await runCodex(args, directory, remaining, task);
		await writeFile(join(jobDir, "build-events.jsonl"), build.stdout);
		await writeFile(join(jobDir, "build-stderr.txt"), build.stderr);
		if (build.timedOut) return finish("deadline_exceeded", build.exitCode);
		if (!build.outputClosed)
			return finish(
				"worker_failed",
				build.exitCode,
				"Native process exited but output pipes did not close",
			);
		if (build.exitCode !== 0) return finish("worker_failed", build.exitCode);
		try {
			const result: unknown = JSON.parse(
				await readFile(join(jobDir, "build-result.json"), "utf8"),
			);
			if (!validBuildResult(result))
				throw new Error("Result does not match the build-result contract");
		} catch {
			return finish(
				"invalid_result",
				build.exitCode,
				"Fresh structured result is missing or invalid",
			);
		}
		return finish("candidate_available", build.exitCode);
	} catch (error) {
		return finish(
			"worker_failed",
			null,
			error instanceof Error ? error.message : String(error),
		);
	}
}

if (import.meta.main) {
	const receipt = await runWorker();
	console.log(JSON.stringify(receipt));
	process.exitCode = receipt.status === "candidate_available" ? 0 : 1;
}
