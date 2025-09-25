# Mercator

Mercator now anchors a **Mastra extractor workspace** that demonstrates agents, memory, resources, and tools working together on ai-sdk v5. The repository ships a single agent that can generate, validate, and persist scraping scripts against the Mercator demo catalog.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a `.env` file inside `apps/mastra` (or export the variable in your shell) with an API key supported by the Vercel AI SDK. OpenAI and OpenRouter keys both work:

```bash
OPENAI_API_KEY=sk-your-key
```

## Local Development

Launch the Mastra playground:

```bash
pnpm dev:agents
```

The command filters down to `apps/mastra` and runs `mastra dev`, which boots the studio with the extractor agent, file-backed memory, domain knowledge storage, and the tools it depends on.

Run the deterministic demo script without opening the studio:

```bash
pnpm demo:agents https://mercator.test/products/simple
```

The demo drives the extractor agent end to end. It reuses a stored script when one exists, or synthesizes a new script by using the registered tools to inspect HTML, validate Cheerio output, and persist the result.

## Repository Layout

```
apps/
  mastra/        # Mastra workspace with agents, memory, resources, tools, and config
fixtures/        # HTML fixtures used by the extractor tools
packages/
  html-utils/    # Shared helpers (currently unused, retained for upcoming work)
```

## Current Slice

The base Mastra project mirrors the manual setup instructions from the Mastra docs with ai-sdk v5 compatibility applied:

1. `apps/mastra/src/mastra/tools` hosts the HTML loader, Cheerio execution harness, and resource persistence helpers.
2. `apps/mastra/src/mastra/resources/domain-knowledge.ts` stores extractor scripts per domain.
3. `apps/mastra/src/mastra/memory/domain-memory.ts` implements a lightweight file-backed memory so the agent can recall past runs.
4. `apps/mastra/src/mastra/agents/extractor-agent.ts` registers the extractor agent that orchestrates tool usage and script persistence.
5. `apps/mastra/src/demo.ts` exposes a small entry point used by `pnpm demo:agents` to call the agent from the terminal.

## Next Steps

- Expand the workspace with additional fixtures and extraction scenarios once the baseline stays stable.
- Re-introduce shared utilities (fixtures, scraping helpers) as focused slices rather than all at once.
- Update the backlog files in `docs/tasks/` as new slices land so future contributors can follow the plan.
