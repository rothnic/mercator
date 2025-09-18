# Quality & Workflow Observations

This report captures the current state of the documentation, regressions that required emergency fixes, technical debt detected in the codebase, and functional gaps that block the end-to-end agent workflow for live URLs.

## Documentation Review

- **README alignment** – The main README now calls out that the implemented workflow only operates on the synthetic `product-simple` fixture and that dynamic URL ingestion remains future work. Contributors must also record lint/test/typecheck runs before declaring tasks complete.
- **Iteration status** – Iteration I01 has progressed beyond planning. The roadmap reflects the in-progress state and links to follow-up tasks for missing capabilities such as reviewer tooling and live URL coverage.
- **Task backlog updates** – The I01 backlog records new follow-up work to enforce orchestration budgets, support URL-driven rule generation, remove brittle Commander aliases, and clean up type casts in the recipe store and validation logic.

## Historical Recovery Work

A review of recent commits highlights recurring error classes:

- **Commander resolution failures** – Tests initially crashed because Vitest could not resolve the `commander` ESM entrypoint. Commit `766b2ed` introduced an alias, and commit `b6a09cd` refined it to the `.pnpm` path. The latter is brittle and tracked as task `I01-F5-T5`.
- **Linting and type coercion fixes** – Commit `2ae7deb` reintroduced lint compliance by stripping ESLint suppressions and adding helper functions, but it also added `as readonly LifecycleEvent[]` casts around recipe lifecycle history. Task `I01-F5-T6` tracks a typed solution.

Documenting these regressions ensures we do not treat the surface as complete until the underlying issues are resolved.

## Build Health

- `pnpm typecheck` fails today because selector definitions omit defaults (e.g., `all` flags, `metrics`) and several modules import `@mercator/core` via path aliases that TypeScript cannot currently resolve. Tasks `I01-F4-T5` and `I01-F5-T6` track the necessary refactors.

## Code Quality Risks

- **Lifecycle history casts** – `packages/recipe-store/src/local-file-system.ts` uses `as readonly LifecycleEvent[]` to satisfy TypeScript, masking schema drift. Tightening the store contract should remove the casts.
- **Validation casts** – `apps/service/src/orchestrator/validation.ts` casts extracted values (`title`, `price`, `images`) because the map of results is untyped. Refactoring to return a structured object will surface missing selectors earlier in tests.
- **Commander alias fragility** – Vitest relies on a `.pnpm`-specific path for `commander`, which will break in environments that do not install dependencies in the same location.

## Agent Workflow Gaps

To support the fully automated workflow (agent receives a URL, refines rules, and executes them without a human-in-the-loop), the following capabilities are still missing:

1. **Live document ingestion** – There is no fetcher for arbitrary URLs. The orchestration service only consumes fixture HTML.
2. **Rule repository persistence** – Rule sets are hard-coded for the fixture. We need storage that can be updated after an agent session so the execution path can reuse the learned selectors.
3. **Agent-guided refinement loop** – The orchestration slice skips the agent loop entirely; it reads selectors from the static rule set. Tool invocations need to be driven by agent prompts with checks that respect domain policies.
4. **Cost and budget enforcement** – While `runAgentOrchestrationSlice` records `AgentBudget`, it never short-circuits passes based on tool counts, elapsed time, or token spend. Without enforcement, the workflow cannot guarantee cost ceilings.
5. **Agent-free execution endpoint** – The `/parse` endpoint assumes a promoted recipe exists but does not expose a way to request extraction for an arbitrary URL. We need an HTTP surface that accepts a URL, selects the right rule set, executes it, and returns structured data.

The new backlog tasks describe how to close these gaps so the next agent can focus on implementation instead of discovery.
