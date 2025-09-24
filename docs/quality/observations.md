# Quality & Workflow Observations

The repository has been reset to a **stub-first vertical slice** so new contributors can iterate without wrestling with unused agents, tools, or infrastructure. This report captures the current documentation state, build health, and the next quality rungs called out in the plan.

## Documentation Review

- The README now describes the minimal runner + agent + tool loop and points to the vertical-slice roadmap.
- Iteration I01 reframes the backlog around the new milestones (execution safety, validation, hints, second fixture).
- The detailed plan lives in `docs/plan/stubs-first-vertical-slice.md`; update it alongside the backlog whenever a slice lands.

## Build Health

- `pnpm lint` and `pnpm test` succeed locally after the reset. The service package exposes `pnpm demo` (wired to the root `pnpm dev:agents`) so the walking skeleton can be exercised without extra setup.
- The Mastra `loadFixtureHtml` tool reads fixture HTML directly from the repo via the shared `@mercator/html-utils` package, and runtime artifacts live under `apps/service/.runtime/`. Supplying `OPENAI_API_KEY` enables live script synthesis; otherwise the deterministic fallback model keeps the loop self-contained.
- Type checking still runs in no-emit mode. Once the execution slice grows, revisit `pnpm typecheck` and decide whether to re-enable stricter settings.

## Current Risks & Follow-Ups

1. **Script execution is still permissive.** The sandbox rejects obvious tokens but does not enforce timeouts or structural guards yet. Milestone I01-F2-T1 tracks the hardened executor.
2. **Validation is shallow.** The baseline only checks for non-empty strings. Promoting Zod-based validation (I01-F2-T2) will surface richer feedback and enable hinting.
3. **Memory only stores scripts.** Hints/anchors are not persisted yet; I01-F2-T3 will introduce structured working memory so regenerated prompts can reuse context.
4. **Single fixture coverage.** The runner only sees `product-simple.html`. Adding the alternate fixture (I01-F2-T4) is critical for measuring reuse vs regeneration.

Document additional findings here as new slices land so the next agent can pick up the thread quickly.
