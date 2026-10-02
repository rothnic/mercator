import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { cases, checkCase } from './acceptance';
import { getRecordDetails } from './tool';

const results = [];
let failures = 0;
const html = await readFile(new URL('./fixture.html', import.meta.url), 'utf8');
const source = await readFile(new URL('./tool.ts', import.meta.url));
const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(html);
});
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No fixture address');
const origin = `http://127.0.0.1:${address.port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.MERCATOR_CHROMIUM ? { executablePath: process.env.MERCATOR_CHROMIUM } : {}),
  });
  for (const test of cases) {
    const context = await browser.newContext();
    try {
      // Only the local fixture is permitted; no model or external site can be contacted.
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      await page.goto(
        `${origin}/${test.mode === 'unsupported' ? 'unsupported' : 'fixture'}#${test.mode}`,
      );
      const started = performance.now();
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const output = await Promise.race([
        getRecordDetails(page, test.input),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('case deadline exceeded')),
            (test.input.timeoutMs ?? 5000) + 3000,
          );
        }),
      ]).finally(() => clearTimeout(deadline));
      try {
        checkCase(test, output);
        results.push({
          case: test.name,
          passed: true,
          elapsedMs: Math.round(performance.now() - started),
          output,
        });
      } catch (error) {
        failures += 1;
        results.push({
          case: test.name,
          passed: false,
          elapsedMs: Math.round(performance.now() - started),
          output,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const report = {
  verifiedAt: new Date().toISOString(),
  toolSha256: createHash('sha256').update(source).digest('hex'),
  acceptanceSha256: createHash('sha256')
    .update(await readFile(new URL('./acceptance.ts', import.meta.url)))
    .digest('hex'),
  browserVersion: browser?.version(),
  transport: 'playwright-headless',
  passed: results.length - failures,
  failed: failures,
  results,
};
await writeFile(
  new URL('./results/replay.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify({ passed: report.passed, failed: failures, toolSha256: report.toolSha256 }),
);
process.exitCode = failures ? 1 : 0;
