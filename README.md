# Mercator

Mercator now ships as a **stub-first Mastra playground**. The goal is to keep the smallest possible walking skeleton in place: one Mastra tool that returns deterministic HTML from fixtures, one scraper agent that emits a Cheerio script (using a live OpenAI model when available), a runner that executes and validates the script, and tiny persistence layers for history and domain knowledge. Everything else will be layered on in incremental, end-to-end slices.

The detailed roadmap for those slices lives in [docs/plan/stubs-first-vertical-slice.md](docs/plan/stubs-first-vertical-slice.md). Start there before expanding the surface area.

## Getting Started

```bash
pnpm install
```

Run the lint and test suites before opening a pull request:

```bash
pnpm lint
pnpm test
```

To explore the Mastra studio, start the development server:

```bash
pnpm dev:agents
```

Mastra opens in your browser with the scraper agent, resources, and memory registered.

To exercise the vertical slice manually, point the runner at a URL. The initial stub maps the Mercator demo fixture and falls back to a tiny generic snippet for unknown domains.

```bash
pnpm demo:agents https://demo.mercator.sh/products/precision-pour-over-kettle
```

The command prints a one-line summary plus the paths to the generated history JSONL file and the persisted domain knowledge record.

## Repository Layout

```
apps/
  service/       # Minimal Mastra playground with runner, agent, tools, and tests
fixtures/        # HTML fixture data consumed by the HTML utilities/tool
packages/
  html-utils/    # Shared helpers for resolving fixture HTML
```

Runtime artifacts (history, domain knowledge) are written to `apps/service/.runtime/` and are ignored by Git.

## Development Loop

The current end-to-end loop intentionally mirrors the "Hello World" slice described in the plan:

1. `apps/service/src/tools/html/load-fixture-html.tool.ts` returns fixture HTML (or a generic fallback) for a requested URL via the shared utility package.
2. `apps/service/src/agent/scraper-agent.ts` asks a Mastra agent to produce a Cheerio IIFE string. When `OPENAI_API_KEY` is defined it calls OpenAI; otherwise it falls back to a deterministic script. Persisted scripts are still reused when available.
3. `apps/service/src/utils/run-cheerio-script.ts` executes the IIFE inside a guarded sandbox.
4. `apps/service/src/validation/validate-extraction.ts` checks for non-empty `{ title, price }` fields.
5. `apps/service/src/resources/domain-knowledge.resource.ts` and `apps/service/src/memory/domain-knowledge.memory.ts` persist extractor scripts alongside Mastra thread history so the second run can reuse both the code and prior context.
6. `apps/service/src/history/history.ts` appends concise JSONL lines for each step (start → tool call → codegen → execution → validation → persistence).
7. `apps/service/src/runner.ts` ties everything together and exposes the CLI entry point.

`apps/service/src/runner.test.ts` proves the loop works by running the scraper twice against the kettle fixture: the first run generates and persists a script, and the second run reuses it.

## Current State & Next Steps

- Firecrawl, Playwright, and the broader agent orchestration stack have been removed from the critical path until the stubbed loop hardens.
- All follow-up work (executing the script against real HTML, adding hints, introducing additional tools, layering in multi-agent workflows, etc.) should be implemented as **tiny vertical slices** that extend this baseline end-to-end.
- Open questions, experiments, and backlog items belong in the plan document and the iteration task files—update them whenever a slice lands so future contributors can continue iterating safely.

If a change touches the agent/tool/memory loop, update the README and plan to match the new reality.
