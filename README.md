# Mercator

Mercator is an adaptive extraction platform that generates reusable recipes for e-commerce pages and executes them deterministically. The repository is organized as a pnpm-managed TypeScript monorepo that will house the headless service, SDK, reviewer UI, shared agent tooling, and supporting fixtures.

## Getting Oriented

1. Start with the [Product Vision](docs/product/vision.md) for durable goals and deliverables.
2. Review the [System Overview](docs/architecture/system-overview.md) to understand planned components and package layout.
3. Check the [Iteration Roadmap](docs/plan/iterations.md) to see how functionality will roll out.
4. Pick the next task from the [Task Backlog](docs/tasks/index.md) and follow the [Task Working Agreement](docs/tasks/README.md).
5. Consult the [Architecture Decisions](docs/decisions/README.md) for rationale behind major choices.

## Monorepo Setup

This workspace uses pnpm for dependency management and shared tooling.

```bash
pnpm install
```

The root `package.json` exposes shared scripts:

| Command | Description |
|---------|-------------|
| `pnpm lint` | Run ESLint with the shared configuration across all packages. |
| `pnpm test` | Execute the Vitest test runner (no suites yet). |
| `pnpm typecheck` | Perform a TypeScript project-wide type check. |
| `pnpm format` | Verify formatting with Prettier. |
| `pnpm dev:agents` | Start the Mastra development playground for the service app. |

## Continuous Integration

Run the lint and test scripts locally before opening a pull request to mirror continuous integration expectations:

```bash
pnpm lint
pnpm test
```

GitHub Actions runs the same commands on every push and pull request via `.github/workflows/ci.yml`.

Each package or app can add additional scripts that are executed via `pnpm --filter`.

## Repository Layout

```
apps/
  service/        # Mastra-powered agent orchestration playground
packages/         # Shared libraries will live here
```

Additional apps (e.g., `reviewer-ui`) and packages (`core`, `sdk`, `agent-tools`) will be added as future tasks land.

## Contributing

- Follow the task priority order; do not skip ahead without approval.
- Update task status directly in the task tables when starting or finishing work.
- Record new architectural choices as ADRs in `docs/decisions/`.
- Keep documentation synchronized with implemented behavior to minimize churn.
- Do not mark a task complete until `pnpm lint` and `pnpm test` succeed locally. Track `pnpm typecheck` progress in the backlog and run it once the outstanding TypeScript debt is resolved.

## Current State & Limitations

The repository currently exercises the workflow against the synthetic `product-simple` fixture only. Dynamic URL ingestion,
rule discovery, and cost-aware budgeting are still open items tracked in the task backlog. CLI and HTTP entrypoints are wired
to the fixture toolchain, so they require local HTML paths generated from the fixtures. Follow-up work to add live document
fetching, persisted rule repositories, and stronger budget enforcement is outlined in `docs/tasks/iteration-01-mvp.md`.
