# @mercator/service

This package hosts the Mastra development playground for Mercator's multi-agent orchestration workflow. It exposes the orchestrator, research, and analysis agents along with a sample workflow that can be exercised via the Mastra dev server or through code examples.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Starts the Mastra dev playground (http://localhost:3000). |
| `pnpm build` | Builds the Mastra project for deployment. |
| `pnpm start` | Runs the built project. |

## Environment

Copy `.env.example` to `.env` and set the required keys:

```bash
cp .env.example .env
```

- `OPENAI_API_KEY` — API key for the configured OpenAI model(s).
- `DATABASE_URL` — Connection string for LibSQL (defaults to an on-disk SQLite database).
- `DATABASE_AUTH_TOKEN` — Optional auth token for remote LibSQL instances.

## Example Usage

A programmatic example is available at `src/examples/basic-execution.ts`. Run it with ts-node or after transpiling via tsc:

```bash
pnpm --filter @mercator/service exec ts-node src/examples/basic-execution.ts
```

The example demonstrates how to invoke the orchestration workflow directly without the dev playground.
