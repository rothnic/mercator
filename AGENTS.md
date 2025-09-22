# Agent Guidelines

These instructions apply to the entire repository. Follow them before submitting changes or marking tasks complete.

## Quality Gates

- Run `pnpm lint` and `pnpm test` locally. Track the effort to get `pnpm typecheck` passing via the backlog and execute it once the blocking debt is closed.
- Record the command output (or a summary) in the task notes so reviewers can trace the verification.
- Keep the documentation in sync with the code. When work lands, update the relevant README, roadmap, or task tables within the same PR.
- Do not reintroduce the Mastra `.mastra/` build artifacts to version control. Confirm both the repo root and service app `.gitignore` files exclude them before opening a PR.

## Coding Practices

- Prefer explicit types and helper functions over `as` casts. If a cast seems necessary, stop and adjust the upstream types (see the backlog tasks on lifecycle history and validation maps).
- Avoid hard-coding paths into `node_modules/.pnpm`. When a dependency cannot be resolved, add a proper entry point or shim instead of reaching into tool-managed directories.
- When you touch orchestration logic, enforce budget limits (passes, tool invocations, elapsed time) instead of logging them only for observability.
- Use the local network helpers (see `apps/service/src/mastra/networks`). The `legacyExtractionNetwork` exposes the synchronous transmit tool used by the orchestrator, while the exported `extractionNetwork` registers the vNext network instance Mastra's playground expects.
- When adding new tools or workspace helpers, wire them through the alias-aware `document-workspace` utilities so that agents can resolve legacy workspace identifiers like `workspace_0`, `default`, or `ingestion_workspace` without runtime failures.

## Workflow Expectations

- Surface newly discovered debt as follow-up tasks in `docs/tasks/iteration-01-mvp.md` (or the relevant iteration file) rather than hiding it in TODO comments.
- Cross-link quality findings to `docs/quality/observations.md` so the next agent can quickly understand outstanding risks.
- For changes that affect the agent workflow, describe the expected end-to-end behavior and remaining gaps in the PR description.
