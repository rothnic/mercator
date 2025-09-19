# Quality & Workflow Observations

This report captures the current state of the documentation, regressions that required emergency fixes, technical debt detected in the codebase, and functional gaps that block the end-to-end agent workflow for live URLs.

## Documentation Review

- **README alignment** – The README now documents the iterative agent workflow, explains how recipes persist with domain/path metadata, and reiterates that observability and reviewer tooling remain future work.
- **Iteration status** – Iteration I01 acceptance criteria now call for iteration logs and domain-targeted execution; Iteration I02 still carries the deferred cleanup/workflows that are not required for the first live run.
- **Task backlog updates** – MVP-critical work in Iteration I01 (`I01-F4-T5`, `I01-F5-T3`, `I01-F5-T4`) is complete; reviewer tooling, Commander alias fixes, lifecycle typing, E2E coverage, and metrics remain scheduled under Iteration I02 tasks `I02-F0-T2` through `I02-F0-T6`.
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

1. **Review experience** – The service captures iteration logs but there is no UI yet for canceling runs, batching additional iterations, or feeding developer guidance between passes. That experience is planned alongside reviewer tooling in Iteration I02.
2. **Rule reuse across restarts** – Generated recipes persist targeting metadata, but the in-memory rule repository still seeds itself from fixtures at startup. Loading stored recipes into the repository would let future generations reuse existing selectors without another agent synthesis loop.

The new backlog tasks describe how to close these gaps so the next agent can focus on implementation instead of discovery.
