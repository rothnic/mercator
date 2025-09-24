# Mercator

Mercator now anchors a **minimal Mastra workspace** so new slices can be layered on without inheriting legacy orchestration code. The repository ships a single agent, a single tool, and the standard Mastra dev server wiring. From here we can iterate toward the richer product-oriented flows once the baseline is stable.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a `.env` file inside `apps/mastra` and provide an API key supported by the Vercel AI SDK (OpenAI is the default):

```bash
OPENAI_API_KEY=sk-your-key
```

## Local Development

Launch the Mastra playground:

```bash
pnpm dev:agents
```

The command filters down to `apps/mastra` and runs `mastra dev`, which boots the studio with the bundled weather agent and tool.

Run the deterministic demo script without opening the studio:

```bash
pnpm demo:agents Paris
```

## Repository Layout

```
apps/
  mastra/        # Mastra workspace with agents, tools, and config
fixtures/        # Legacy fixture data kept for future slices
packages/
  html-utils/    # Shared helpers (currently unused, retained for upcoming work)
```

## Current Slice

The base Mastra project mirrors the manual setup instructions from the Mastra docs with ai-sdk v5 compatibility applied:

1. `apps/mastra/src/mastra/tools/weather-tool.ts` defines a `get-weather` tool with a simple Zod contract.
2. `apps/mastra/src/mastra/agents/weather-agent.ts` registers a weather agent that calls the tool when asked about conditions.
3. `apps/mastra/src/mastra/index.ts` exports the `Mastra` instance consumed by the CLI server.
4. `apps/mastra/src/demo.ts` exposes a small entry point used by `pnpm demo:agents` to call the agent from the terminal.

## Next Steps

- Expand the workspace with domain-specific agents once the weather example is confirmed working end to end.
- Re-introduce shared utilities (fixtures, scraping helpers) as focused slices rather than all at once.
- Update the backlog files in `docs/tasks/` as new slices land so future contributors can follow the plan.
