# ADR 0001 – Monorepo Tech Stack

## Status
Proposed – review before starting Iteration I01 scaffolding work.

## Context
Mercator must deliver a headless service, SDK, shared core libraries, agent tooling, and a reviewer UI. These components need shared type safety (Zod schemas), consistent build tooling, and straightforward local development. The PRD emphasizes lean vertical slices with rapid iteration across these deliverables.

## Decision
Adopt a **TypeScript monorepo** managed with **pnpm workspaces**. Organize the repository with top-level `apps/` (service, reviewer UI) and `packages/` (core domain logic, SDK, agent tools, shared utilities). Centralize TypeScript configuration, linting, and testing at the workspace root. Publishable packages (e.g., `@mercator/sdk`) will be versioned via pnpm workspaces and prepared for npm publishing from the same repo.

## Rationale
- Shared TypeScript types and Zod schemas can be imported across service, SDK, and UI without duplication.
- pnpm offers fast installs, deterministic lockfiles, and built-in workspace linking suitable for agents and CI pipelines.
- Monorepo layout simplifies orchestrating thin vertical slices touching multiple products in a single change.
- Keeping tooling consistent reduces ramp-up for new agents and supports automated checks.

## Consequences
- Requires initial investment in workspace configuration (captured in task `I01-F1-T1`).
- CI must understand pnpm caching strategies; addressed in task `I01-F1-T2`.
- Publishing flows need scripts to build individual packages without dragging in server-only dependencies.
- Future ADRs should revisit this choice if scale or tooling constraints emerge (e.g., need for Bazel/Nx).
