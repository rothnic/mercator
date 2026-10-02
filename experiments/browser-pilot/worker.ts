import { spawn, spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// One bounded native Codex attempt. Scheduling and promotion stay outside this script.
if (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY) {
  throw new Error(
    'This subscription pilot refuses API-key overrides; use ChatGPT-authenticated Codex.',
  );
}
const auth = spawnSync('codex', ['login', 'status'], { encoding: 'utf8' });
if (auth.status !== 0 || !`${auth.stdout}${auth.stderr}`.includes('Logged in using ChatGPT')) {
  console.log(
    JSON.stringify({
      status: 'auth_required',
      instruction: 'Run codex login on the owning worker.',
    }),
  );
  process.exit(1);
}
const timeoutMs = 10 * 60 * 1000;
const task = await readFile(new URL('./BUILD_TASK.md', import.meta.url), 'utf8');
const directory = new URL('./results/', import.meta.url);
await mkdir(directory, { recursive: true });
const args = [
  'exec',
  '--ignore-user-config',
  '--sandbox',
  'workspace-write',
  '-c',
  'approval_policy="never"',
  '--json',
  '--output-schema',
  resolve(import.meta.dir, 'build-result.schema.json'),
  '--output-last-message',
  resolve(import.meta.dir, 'results/build-result.json'),
  ...(process.env.MERCATOR_MODEL ? ['--model', process.env.MERCATOR_MODEL] : []),
  '-',
];
const child = spawn('codex', args, { cwd: import.meta.dir, stdio: ['pipe', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';
let timedOut = false;
const deadline = setTimeout(() => {
  timedOut = true;
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 1000).unref();
}, timeoutMs);
child.stdout.on('data', (data) => {
  stdout += data;
});
child.stderr.on('data', (data) => {
  stderr += data;
});
child.stdin.end(task);
const exitCode = await new Promise<number | null>((resolveExit, reject) => {
  child.once('error', reject);
  child.once('close', resolveExit);
}).finally(() => clearTimeout(deadline));
await writeFile(new URL('build-events.jsonl', directory), stdout);
await writeFile(new URL('build-stderr.txt', directory), stderr);
const status = timedOut
  ? 'deadline_exceeded'
  : exitCode === 0
    ? 'candidate_available'
    : 'worker_failed';
console.log(JSON.stringify({ status, exitCode, authentication: 'chatgpt', timeoutMs }));
process.exitCode = exitCode === 0 && !timedOut ? 0 : 1;
