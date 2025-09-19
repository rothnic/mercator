# Iteration I01 — MVP Product Page Loop

## Goal
Deliver the minimal workflow that can fetch a product detail page from an arbitrary URL, run the agent slice to synthesize a selector-based recipe, persist it, and execute it deterministically via CLI/HTTP entrypoints. Tests may continue to rely on the synthetic fixture for predictable assertions, but live usage must not require pre-seeded rules.

## Milestones

1. **Scaffold** – Monorepo + core packages with schemas, recipe model, and fixtures ready.
2. **Loop** – Agent orchestration that inspects fetched HTML and produces a candidate selector recipe without relying on fixture rule sets.
3. **Execution** – Service/CLI routes that persist the generated recipe and execute the promoted recipe without AI, returning validated JSON for the requested URL.
4. **Quality Gate** – Unit tests for transforms/tolerances and an end-to-end test covering live URL generation vs execution (using fixtures for determinism where necessary).

## Feature Backlog

Priority is ascending within each feature. Always complete lower-numbered tasks before moving to higher numbers unless explicitly re-ordered.

### F1. Repository Foundation & Tooling

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F1-T1 | Bootstrap pnpm workspace with `apps/` and `packages/` folders, TypeScript config, lint/test scripts, and shared tsconfig/eslint/prettier configs. | pnpm workspace config, root `package.json`, lint/test npm scripts, baseline README updates. | — | Done | Set up pnpm workspace plus Mastra service app scaffolding. |
| 2 | I01-F1-T2 | Configure basic CI (GitHub Actions) running lint and tests; document local dev commands. | `.github/workflows/ci.yml`, docs update in README. | I01-F1-T1 | Done | Optional skip if CI unavailable; document rationale. |

### F2. Core Domain & Recipe Schema

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F2-T1 | Create `packages/core` with TypeScript models + Zod schemas for Product (subset needed for MVP), Money, Breadcrumb, and supporting types per Appendix A. | `packages/core/src/schemas.ts`, unit tests validating schema behavior. | I01-F1-T1 | Done | Initial `@mercator/core` domain schemas and tests. |
| 2 | I01-F2-T2 | Define unified recipe schema (TypeScript + Zod) capturing selector steps, transforms, tolerances, validators, metrics, lifecycle metadata. | `packages/core/src/recipe.ts`, schema tests ensuring optional Playwright fields for later iterations. | I01-F2-T1 | Done | Implemented recipe schema plus helpers in `@mercator/core`, including lifecycle + provenance coverage. |
| 3 | I01-F2-T3 | Record default tolerance + transform configs and expose typed helpers. | `packages/core/src/tolerances.ts`, `transforms.ts`, tests for `text.collapse`, `money.parse`, `url.resolve`. | I01-F2-T2 | Done | Added deterministic defaults + helper exports with defensive-copy tests. |

### F3. Fixtures & Tool Surface

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F3-T1 | Add synthetic product fixture assets (HTML, markdown, screenshot) and loader utilities. | `fixtures/product-simple.html`, `.md`, `.png.base64`, loader module exporting typed accessors. | I01-F1-T1 | Done | Adds kettle fixture assets, loader, and documentation. |
| 2 | I01-F3-T2 | Implement minimal agent tool interfaces for vision OCR stub, chunked HTML queries, markdown search returning deterministic data from fixtures. | `packages/agent-tools/src/index.ts`, stub implementations referencing fixtures. | I01-F3-T1, I01-F2-T2 | Done | Stubbed vision, HTML, and markdown tools with usage logging. |

### F4. Agent Orchestration Slice

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F4-T1 | Define agent context contracts and orchestrator skeleton covering Pass 1–3 with stubbed agents producing ExpectedData and candidate recipe steps. | `packages/core/src/agents/` (interfaces), orchestrator in `apps/service` or shared package, unit tests for control flow. | I01-F2-T2, I01-F3-T2 | Done | refactor: drive orchestrator from rule repository (b68add2). |
| 2 | I01-F4-T2 | Implement selector recipe synthesis for fixture (map expected fields to CSS selectors, apply transforms/tolerances). | Module producing recipe object, tests verifying selectors match fixture DOM. | I01-F4-T1 | Done | refactor: drive orchestrator from rule repository (b68add2). |
| 3 | I01-F4-T3 | Implement validator pass computing per-field/document confidence using tolerance helpers and Zod. | Validation module + tests verifying success/failure cases for fixture variations. | I01-F4-T2, I01-F2-T3 | Done | refactor: drive orchestrator from rule repository (b68add2). |
| 4 | I01-F4-T4 | Enforce orchestration budget and token spend limits before each pass. | Budget tracker that halts passes when limits are exceeded, unit tests covering stop conditions. | I01-F4-T3 | Done | Added budget guard that stops passes once pass, tool invocation, or duration limits are exceeded. |
| 5 | I01-F4-T5 | Enable orchestration to derive selectors when no rule set exists by analyzing fetched HTML. | Update the orchestration passes so an empty rule repository still produces a candidate recipe and expected data for required product fields; add fixture-driven tests for the fallback path. | I01-F4-T3 | Done | Agent workflow now iteratively seeds target data, refines selectors with OCR/text-driven heuristics instead of hard-coded values, and records iteration logs when no rule set is found. |

> The validation result typing cleanup previously tracked as `I01-F4-T5` moved to Iteration I02 as task `I02-F0-T1`.

### F5. Service, CLI & Recipe Store

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F5-T1 | Implement LocalFS-backed recipe store with versioned state machine (`draft → stable`). | Store module + tests covering save/promote/list. | I01-F2-T2 | Done | `packages/recipe-store` provides the adapter but still uses casts around lifecycle history. |
| 2 | I01-F5-T2 | Create REST + CLI endpoints for `/recipes/generate`, `/recipes/promote`, `/parse` wired to orchestrator and recipe store. | Service handlers, CLI commands, integration test hitting fixture path. | I01-F4-T3, I01-F5-T1 | Done | Endpoints now accept live URLs, fetch documents, and reuse stored recipes; CLI and Fastify handlers share the workflow service. |
| 3 | I01-F5-T3 | Target recipes by domain/path when reading from the store and return an explicit error when no stable recipe exists for a requested URL. | Extend the recipe store/query API to accept domain/path lookups plus service integration coverage. | I01-F5-T2 | Done | Store records now capture domain/path metadata and `/parse` fails fast when no stable recipe is available. |
| 4 | I01-F5-T4 | Persist newly generated recipes as reusable rule sets keyed by domain/path for arbitrary URLs. | Workflow service updates that write rule metadata alongside recipes and reload it on startup; integration test covering URL → generate → promote → parse without fixture rule seeds. | I01-F5-T3 | Done | Generated recipes store targeting metadata so once promoted they can be reused for parsing without re-running the agent loop. |
| 5 | I01-F5-T7 | Restore Fastify resolution in Vitest integration tests. | Update test/bundler config so `fastify` loads during service integration tests. | I01-F5-T2 | Done | Install workspace dependencies (`pnpm install`) so Fastify resolves before running `pnpm test`. |

> Reviewer tooling, Commander resolution, and lifecycle typing cleanups now live under Iteration I02 as tasks `I02-F0-T2` through `I02-F0-T4`.

### F6. Testing & Observability Baseline

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F6-T1 | Write unit tests for transforms, tolerances, and recipe schema invariants. | Test suite covering success/failure cases. | I01-F2-T3 | Done | Covered recipe parsing and transform/tolerance helpers via Vitest. |

> Broader end-to-end coverage and metrics instrumentation moved to Iteration I02 as tasks `I02-F0-T5` and `I02-F0-T6`.

## Acceptance Criteria

- Given a product URL with no stored rules, the workflow service can fetch the document, run orchestration, and persist a draft recipe with selectors for the required product fields. Selector synthesis must leverage OCR/text heuristics rather than fixture-specific selector constants so the workflow applies to arbitrary pages.
- During generation the agent loop records iteration logs that show how the target data and selectors evolved until validation succeeded.
- Once a recipe is promoted to stable, `/parse` and the CLI select the matching recipe for the requested domain/path and execute it without invoking the agent slice.
- Requests for URLs without a stable recipe return a clear error indicating generation must run first.
- Unit tests cover core transforms/tolerances; integration tests exercise the URL generation → promote → parse loop (fixtures acceptable for deterministic assertions).

Document open questions or follow-up work in `Notes` fields or create new tasks for future iterations.

## Agent Workflow Overview

- Initialization runs automatically after fetching a document. OCR seeding and HTML probes provide a starting target data set without requiring manual confirmation.
- The agent iteratively refines selectors and target data, emitting an iteration log that records the agent’s reasoning, selector updates, and scraped samples after each pass.
- Workflow consumers must remain responsive: downstream UI work will expose cancel controls, iteration batching, and human-in-the-loop feedback before promotion.
