# Iteration I01 — MVP Product Page Loop

## Goal
Deliver a deterministic end-to-end slice that generates, validates, reviews, stores, and executes a selector-based recipe for the synthetic product fixture. All work should reinforce the separation between the AI-assisted generation path and the deterministic execution path.

## Milestones

1. **Scaffold** – Monorepo + core packages with schemas, recipe model, and fixtures ready.
2. **Loop** – Agent orchestration stub that consumes fixture inputs and produces a candidate selector recipe.
3. **Execution** – Service/CLI route that executes the promoted recipe without AI, returning validated JSON.
4. **Quality Gate** – Unit tests for transforms/tolerances and an end-to-end test covering generation vs execution on the fixture.

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
| 5 | I01-F4-T5 | Replace untyped field extraction map with structured result object. | Refactor validation utilities to return typed values without `as` casts. | I01-F4-T3 | Todo | `apps/service/src/orchestrator/validation.ts` relies on casts for `title`, `price`, and `images`. |

### F5. Service, CLI & Recipe Store

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F5-T1 | Implement LocalFS-backed recipe store with versioned state machine (`draft → stable`). | Store module + tests covering save/promote/list. | I01-F2-T2 | Done | `packages/recipe-store` provides the adapter but still uses casts around lifecycle history. |
| 2 | I01-F5-T2 | Create REST + CLI endpoints for `/recipes/generate`, `/recipes/promote`, `/parse` wired to orchestrator and recipe store. | Service handlers, CLI commands, integration test hitting fixture path. | I01-F4-T3, I01-F5-T1 | Done | Endpoints now accept live URLs, fetch documents, and reuse stored recipes; CLI and Fastify handlers share the workflow service. |
| 3 | I01-F5-T3 | Add reviewer stub endpoint returning tri-pane payload (screenshot, DOM snippet, JSON diff) for HITL. | Endpoint returning deterministic fixture data + placeholder UI data contract. | I01-F5-T2 | Todo | Document UI contract for later implementation. |
| 4 | I01-F5-T4 | Support live document ingestion and rule persistence for arbitrary URLs. | HTTP fetcher, rule repository updates, and tests covering URL → rule → parse loop without fixtures. | I01-F5-T2 | Done | Added URL fetcher + rule-aware toolset so orchestrator can run against any rule-backed URL; integration test covers URL generation/promotion/parse flow. |
| 5 | I01-F5-T5 | Stabilize Commander resolution for CLI/tests without `.pnpm` path assumptions. | Shared resolver utility or ESM-friendly dependency injection with tests. | I01-F5-T2 | Todo | `apps/service/vitest.config.ts` aliases Commander via `.pnpm`, which breaks on fresh installs. |
| 6 | I01-F5-T6 | Remove lifecycle history casts from the LocalFS store. | Update store inputs/types so history normalizes without `as readonly LifecycleEvent[]`. | I01-F5-T1 | Todo | Type casts around lifecycle history mask schema regressions in `packages/recipe-store`. |
| 7 | I01-F5-T7 | Restore Fastify resolution in Vitest integration tests. | Update test/bundler config so `fastify` loads during service integration tests. | I01-F5-T2 | Done | Install workspace dependencies (`pnpm install`) so Fastify resolves before running `pnpm test`. |

### F6. Testing & Observability Baseline

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F6-T1 | Write unit tests for transforms, tolerances, and recipe schema invariants. | Test suite covering success/failure cases. | I01-F2-T3 | Done | Covered recipe parsing and transform/tolerance helpers via Vitest. |
| 2 | I01-F6-T2 | Implement `E2E-Gen` and `E2E-Exec` tests covering full loop on synthetic fixture. | Integration tests verifying recipe generation/execution parity and determinism. | I01-F4-T3, I01-F5-T2 | Todo | Include budget assertions and evidence matrix checks. |
| 3 | I01-F6-T3 | Instrument minimal metrics logging (query counts, duration) and expose via structured logs. | Logging utility, doc snippet on metrics interpretation. | I01-F4-T1 | Todo | Metrics stored locally for now; later iterations add exporters. |

## Acceptance Criteria

- Generation pipeline produces a selector-based recipe for the synthetic fixture with populated `title`, `price`, `images[0]`, `canonicalUrl`, `aggregateRating?`, and `breadcrumb` when available.
- `/parse` endpoint/CLI command executes the stable recipe without invoking agents/LLMs and returns data passing schema validation.
- Unit and E2E tests cover core transforms, tolerance policies, recipe lifecycle, and full loop success.
- Logs capture tool usage counts and elapsed time per pass.

Document open questions or follow-up work in `Notes` fields or create new tasks for future iterations.
