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
| 2 | I01-F2-T2 | Define unified recipe schema (TypeScript + Zod) capturing selector steps, transforms, tolerances, validators, metrics, lifecycle metadata. | `packages/core/src/recipe.ts`, schema tests ensuring optional Playwright fields for later iterations. | I01-F2-T1 | Todo | Base tolerances on Appendix B defaults. |
| 3 | I01-F2-T3 | Record default tolerance + transform configs and expose typed helpers. | `packages/core/src/tolerances.ts`, `transforms.ts`, tests for `text.collapse`, `money.parse`, `url.resolve`. | I01-F2-T2 | Todo | Include deterministic behavior & locale assumptions docstring. |

### F3. Fixtures & Tool Surface

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F3-T1 | Add synthetic product fixture assets (HTML, markdown, screenshot) and loader utilities. | `fixtures/product-simple.html`, `.md`, `.png`, loader module exporting typed accessors. | I01-F1-T1 | Todo | Document fixture structure & expected values in `docs/fixtures/product-simple.md`. |
| 2 | I01-F3-T2 | Implement minimal agent tool interfaces for vision OCR stub, chunked HTML queries, markdown search returning deterministic data from fixtures. | `packages/agent-tools/src/index.ts`, stub implementations referencing fixtures. | I01-F3-T1, I01-F2-T2 | Todo | Tools should log usage for later observability. |

### F4. Agent Orchestration Slice

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F4-T1 | Define agent context contracts and orchestrator skeleton covering Pass 1–3 with stubbed agents producing ExpectedData and candidate recipe steps. | `packages/core/src/agents/` (interfaces), orchestrator in `apps/service` or shared package, unit tests for control flow. | I01-F2-T2, I01-F3-T2 | Todo | Use deterministic prompts/stubs; no LLM calls. |
| 2 | I01-F4-T2 | Implement selector recipe synthesis for fixture (map expected fields to CSS selectors, apply transforms/tolerances). | Module producing recipe object, tests verifying selectors match fixture DOM. | I01-F4-T1 | Todo | Capture provenance/evidence matrix structure even if stubbed. |
| 3 | I01-F4-T3 | Implement validator pass computing per-field/document confidence using tolerance helpers and Zod. | Validation module + tests verifying success/failure cases for fixture variations. | I01-F4-T2, I01-F2-T3 | Todo | Include enforcement of stopping criteria for title/price. |

### F5. Service, CLI & Recipe Store

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F5-T1 | Implement LocalFS-backed recipe store with versioned state machine (`draft → stable`). | Store module + tests covering save/promote/list. | I01-F2-T2 | Todo | Prepare adapter pattern for future stores. |
| 2 | I01-F5-T2 | Create REST + CLI endpoints for `/recipes/generate`, `/recipes/promote`, `/parse` wired to orchestrator and recipe store. | Service handlers, CLI commands, integration test hitting fixture path. | I01-F4-T3, I01-F5-T1 | Todo | CLI should call same underlying services to avoid drift. |
| 3 | I01-F5-T3 | Add reviewer stub endpoint returning tri-pane payload (screenshot, DOM snippet, JSON diff) for HITL. | Endpoint returning deterministic fixture data + placeholder UI data contract. | I01-F5-T2 | Todo | Document UI contract for later implementation. |

### F6. Testing & Observability Baseline

| Priority | Task ID | Description | Deliverables | Depends On | Status | Notes |
|----------|---------|-------------|--------------|------------|--------|-------|
| 1 | I01-F6-T1 | Write unit tests for transforms, tolerances, and recipe schema invariants. | Test suite covering success/failure cases. | I01-F2-T3 | Todo | Add snapshot tests for tolerance normalization. |
| 2 | I01-F6-T2 | Implement `E2E-Gen` and `E2E-Exec` tests covering full loop on synthetic fixture. | Integration tests verifying recipe generation/execution parity and determinism. | I01-F4-T3, I01-F5-T2 | Todo | Include budget assertions and evidence matrix checks. |
| 3 | I01-F6-T3 | Instrument minimal metrics logging (query counts, duration) and expose via structured logs. | Logging utility, doc snippet on metrics interpretation. | I01-F4-T1 | Todo | Metrics stored locally for now; later iterations add exporters. |

## Acceptance Criteria

- Generation pipeline produces a selector-based recipe for the synthetic fixture with populated `title`, `price`, `images[0]`, `canonicalUrl`, `aggregateRating?`, and `breadcrumb` when available.
- `/parse` endpoint/CLI command executes the stable recipe without invoking agents/LLMs and returns data passing schema validation.
- Unit and E2E tests cover core transforms, tolerance policies, recipe lifecycle, and full loop success.
- Logs capture tool usage counts and elapsed time per pass.

Document open questions or follow-up work in `Notes` fields or create new tasks for future iterations.
