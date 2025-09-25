# @mercator/mastra

This workspace hosts the Mastra project that powers Mercator's agent development flow. It follows the Mastra manual setup with ai-sdk v5 compatibility and wires in the extractor agent, memory, tools, and resources required by the demo.

## Prerequisites

1. Node.js 20+
2. `pnpm install`
3. Provide an API key supported by the Vercel AI SDK (`OPENAI_API_KEY`, OpenRouter, etc.) in `apps/mastra/.env` or your shell.

## Commands

- `pnpm dev:agents` – start the Mastra studio against this workspace.
- `pnpm demo:agents [url]` – run the extractor agent once against a URL (defaults to `https://mercator.test/products/simple`).
- `pnpm --filter @mercator/mastra run test` – execute Vitest over the Mastra workspace utilities.

The studio boot sequence loads:

- **Agent** – `extractorAgent`, which orchestrates script generation, validation, and persistence.
- **Memory** – file-backed `DomainMemory` that stores chat history per resource path.
- **Resources** – domain knowledge registry that persists extractor scripts under `apps/mastra/.runtime/domains`.
- **Tools** – HTML fixture loader, Cheerio executor, and persistence helpers that the agent must use for every run.

## Directory Layout

```
src/
  demo.ts                 # CLI entry point for scripted runs
  mastra/
    agents/
      extractor-agent.ts  # Extractor agent definition with instructions and tools
    index.ts              # Mastra instance exported for the CLI and studio
    memory/
      domain-memory.ts    # File-backed Mastra memory implementation
    resources/
      domain-knowledge.ts # Domain-specific extractor registry helpers
    tools/
      *.tool.ts           # Tool definitions used by the agent
```

The `.runtime` directory is created on demand and contains serialized memory and domain knowledge. It is ignored by Git but safe to delete when you want a clean slate.
