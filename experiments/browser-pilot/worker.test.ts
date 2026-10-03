import { test, expect } from "bun:test";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runWorker } from "./worker";

// These subprocess fixtures exercise the adapter, not live subscription inference.
async function withCodex(
	scenario: string,
	check: (directory: string) => Promise<void>,
) {
	const directory = await mkdtemp(join(tmpdir(), "mercator-worker-test-"));
	const bin = join(directory, "bin");
	await mkdir(bin);
	for (const name of ["BUILD_TASK.md", "build-result.schema.json"]) {
		await copyFile(
			new URL(`./${name}`, import.meta.url),
			join(directory, name),
		);
	}
	await writeFile(
		join(bin, "codex"),
		`#!${process.execPath}
import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const scenario = ${JSON.stringify(scenario)};
const args = process.argv.slice(2);
if (args[0] === "login") {
  if (scenario === "auth-hang") {
    process.on("SIGTERM", () => {});
    setInterval(() => {}, 1000);
  } else {
    console.log(scenario === "api-auth" ? "Logged in using an API key" : "Logged in using ChatGPT");
    process.exit(scenario === "auth-failed" ? 1 : 0);
  }
} else {
  writeFileSync("arguments.json", JSON.stringify(args));
  await Bun.stdin.text();
  if (scenario === "build-hang") {
    setInterval(() => {}, 1000);
  } else {
    const output = args[args.indexOf("--output-last-message") + 1];
    const value = { summary: "fixture result", changed_files: [], checks_run: [], remaining_limits: [] };
    if (scenario === "wrong-type") value.checks_run = [42];
    if (scenario === "extra-field") value.unexpected = true;
    if (scenario !== "missing") writeFileSync(output, scenario === "invalid-json" ? "{" : JSON.stringify(value));
    if (scenario === "pipe-holder") {
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"] });
      child.unref();
      writeFileSync("descendant.pid", String(child.pid));
    }
    process.exit(scenario === "build-failed" ? 1 : 0);
  }
}
`,
		{ mode: 0o700 },
	);
	const previous = {
		PATH: process.env.PATH,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		CODEX_API_KEY: process.env.CODEX_API_KEY,
	};
	process.env.PATH = bin; // A missing fixture cannot fall through to real Codex.
	delete process.env.OPENAI_API_KEY;
	delete process.env.CODEX_API_KEY;
	try {
		await check(directory);
	} finally {
		try {
			const pid = Number(
				await readFile(join(directory, "descendant.pid"), "utf8"),
			);
			process.kill(pid, "SIGKILL");
		} catch {} // The fixture descendant may already have exited.
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		await rm(directory, { recursive: true, force: true });
	}
}

test("each successful attempt has fresh result files and native sandbox flags", async () => {
	await withCodex("valid", async (directory) => {
		const first = await runWorker(directory);
		const second = await runWorker(directory);
		expect(first.status).toBe("candidate_available");
		expect(second.status).toBe("candidate_available");
		expect(first.jobDir).not.toBe(second.jobDir);
		const args = JSON.parse(
			await readFile(join(directory, "arguments.json"), "utf8"),
		);
		expect(args).toContain("--ignore-user-config");
		expect(args[args.indexOf("--sandbox") + 1]).toBe("workspace-write");
		expect(args).toContain('approval_policy="never"');
		expect(args[args.indexOf("--output-last-message") + 1]).toBe(
			join(second.jobDir, "build-result.json"),
		);
		expect(
			JSON.parse(
				await readFile(join(second.jobDir, "worker-receipt.json"), "utf8"),
			),
		).toEqual(second);
	});
});

test("exit zero without new output cannot reuse a stale result", async () => {
	await withCodex("missing", async (directory) => {
		await mkdir(join(directory, "results"));
		await writeFile(
			join(directory, "results/build-result.json"),
			'{"summary":"old result"}',
		);
		const receipt = await runWorker(directory);
		expect(receipt.status).toBe("invalid_result");
		expect(receipt.exitCode).toBe(0);
	});
});

for (const scenario of ["invalid-json", "wrong-type", "extra-field"]) {
	test(`fresh ${scenario} output is rejected`, async () => {
		await withCodex(scenario, async (directory) => {
			expect((await runWorker(directory)).status).toBe("invalid_result");
		});
	});
}

test("auth or build failure cannot report a candidate", async () => {
	for (const scenario of ["api-auth", "auth-failed", "build-failed"]) {
		await withCodex(scenario, async (directory) => {
			expect((await runWorker(directory)).status).toBe(
				scenario === "build-failed" ? "worker_failed" : "auth_required",
			);
		});
	}
});

for (const scenario of ["auth-hang", "build-hang"]) {
	test(`${scenario} exhausts the shared finite attempt deadline`, async () => {
		await withCodex(scenario, async (directory) => {
			expect((await runWorker(directory, 1500)).status).toBe(
				"deadline_exceeded",
			);
			if (scenario === "build-hang") {
				expect(
					JSON.parse(
						await readFile(join(directory, "arguments.json"), "utf8"),
					)[0],
				).toBe("exec");
			}
		});
	});
}

test("API-key overrides fail closed before native execution", async () => {
	await withCodex("valid", async (directory) => {
		process.env.OPENAI_API_KEY = "test-only-key";
		expect((await runWorker(directory)).status).toBe("configuration_error");
		await expect(readFile(join(directory, "arguments.json"))).rejects.toThrow();
	});
});

test("a missing native executable leaves a failed attempt receipt", async () => {
	await withCodex("valid", async (directory) => {
		await rm(join(directory, "bin/codex"));
		const receipt = await runWorker(directory);
		expect(receipt.status).toBe("worker_failed");
		expect(
			JSON.parse(
				await readFile(join(receipt.jobDir, "worker-receipt.json"), "utf8"),
			),
		).toEqual(receipt);
	});
});

test("a descendant retaining output pipes cannot hang the adapter or report success", async () => {
	await withCodex("pipe-holder", async (directory) => {
		const receipt = await runWorker(directory, 3000);
		expect(receipt.status).toBe("worker_failed");
		expect(receipt.exitCode).toBe(0);
		expect(receipt.reason).toBe(
			"Native process exited but output pipes did not close",
		);
	});
});
