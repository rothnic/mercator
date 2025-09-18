# Quality & Workflow Observations

This report captures the current state of the documentation, regressions that required emergency fixes, technical debt detected in the codebase, and functional gaps that block the end-to-end agent workflow for live URLs.

## Documentation Review

- **README alignment** – The README now calls out that arbitrary URLs will fail until tasks `I01-F4-T5`, `I01-F5-T3`, and `I01-F5-T4` land, highlighting the remaining blockers to real-world usage.
- **Iteration status** – Iteration I01 is explicitly scoped to those minimal tasks, while Iteration I02 carries the deferred cleanup/workflows that are not required for the first live run.
- **Task backlog updates** – MVP-critical work sits in Iteration I01 (`I01-F4-T5`, `I01-F5-T3`, `I01-F5-T4`); reviewer tooling, Commander alias fixes, lifecycle typing, E2E coverage, and metrics were moved into Iteration I02 as tasks `I02-F0-T2` through `I02-F0-T6`.
- **Budget enforcement** – Task `I01-F4-T4` added runtime budget guards so orchestration stops once pass, tool invocation, or duration limits are exhausted.

## Historical Recovery Work

A review of recent commits highlights recurring error classes:

- **Commander resolution failures** – Tests initially crashed because Vitest could not resolve the `commander` ESM entrypoint. Commit `766b2ed` introduced an alias, and commit `b6a09cd` refined it to the `.pnpm` path. The latter is brittle and is now tracked as task `I02-F0-T3`.
- **Linting and type coercion fixes** – Commit `2ae7deb` reintroduced lint compliance by stripping ESLint suppressions and adding helper functions, but it also added `as readonly LifecycleEvent[]` casts around recipe lifecycle history. Task `I02-F0-T4` tracks a typed solution.

Documenting these regressions ensures we do not treat the surface as complete until the underlying issues are resolved.

## Build Health

- `pnpm typecheck` fails today because selector definitions omit defaults (e.g., `all` flags, `metrics`) and several modules import `@mercator/core` via path aliases that TypeScript cannot currently resolve. Tasks `I02-F0-T1` and `I02-F0-T4` track the necessary refactors.
- `pnpm test` now exercises the Fastify-backed integration suite. Ensure dependencies are installed via `pnpm install` so the HTTP server resolves before running tests.

## Code Quality Risks

- **Lifecycle history casts** – `packages/recipe-store/src/local-file-system.ts` uses `as readonly LifecycleEvent[]` to satisfy TypeScript, masking schema drift. Tightening the store contract (tracked in `I02-F0-T4`) should remove the casts.
- **Validation casts** – `apps/service/src/orchestrator/validation.ts` casts extracted values (`title`, `price`, `images`) because the map of results is untyped. Refactoring to return a structured object (task `I02-F0-T1`) will surface missing selectors earlier in tests.
- **Commander alias fragility** – Vitest relies on a `.pnpm`-specific path for `commander`, which will break in environments that do not install dependencies in the same location (see `I02-F0-T3`).

## Agent Workflow Gaps

To support the fully automated workflow (agent receives a URL, refines rules, and executes them without a human-in-the-loop), the following capabilities are still missing:

1. **Dynamic recipe synthesis** – The orchestration slice still expects a rule set seeded from fixtures. Task `I01-F4-T5` must teach it to inspect the fetched HTML and propose selectors/expected data without any prior configuration.
2. **Target-aware persistence** – Stable recipes are not indexed by domain/path today. Tasks `I01-F5-T3` and `I01-F5-T4` will persist agent output with targeting metadata so `/parse` can execute the correct rules or return a clear “generate first” error.

The new backlog tasks describe how to close these gaps so the next agent can focus on implementation instead of discovery.
