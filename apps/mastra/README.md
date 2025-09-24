# @mercator/mastra

This package hosts the Mastra development workspace used by the repository. It mirrors the manual setup from the Mastra docs while opting into ai-sdk v5 compatibility so the OpenAI integration works with the latest SDK.

## Commands

- `pnpm dev` — launch the Mastra playground (wired to `pnpm dev:agents` at the repo root).
- `pnpm build` — build the project using the Mastra CLI.
- `pnpm demo` — run the lightweight CLI script in `src/demo.ts` (pass a location name).

Provide an API key compatible with the Vercel AI SDK by creating a `.env` file next to this README:

```bash
OPENAI_API_KEY=sk-your-key
```

## Directory Layout

```
src/
  demo.ts                   # Small CLI entry point used by `pnpm demo`
  mastra/
    agents/weather-agent.ts # Single agent registered with Mastra
    tools/weather-tool.ts   # Example tool called by the agent
    index.ts                # Mastra instance exported to the CLI
```

Add new agents or tools under `src/mastra` and register them inside `index.ts` so they appear in the playground.
