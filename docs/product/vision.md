# Product Vision

Mercator delivers clean, validated product and collection data from any e-commerce page through an adaptive agent-assisted workflow. The service must remain extraction-method agnostic while producing reusable recipes that can be executed deterministically without large language models.

## Durable Goals

- **Recipe-first extraction** – Generate reusable selector/Playwright/hybrid recipes during an agent-driven assessment loop, then execute them without AI involvement.
- **High-confidence page understanding** – Detect product vs collection pages with provenance and confidence scoring, and guard critical fields (`title`, `price`) with strict tolerances.
- **End-to-end workflow coverage** – Support recipe generation, validation, review (HITL transitioning to agent review), promotion, reuse, and rollback.
- **Human-in-the-loop quality** – Provide reviewer tools and audit trails so humans or agents can approve, regress, or escalate recipes safely.
- **Observability & governance** – Capture metrics (coverage, confidence, latency, budget) and respect policy/tenant isolation, robots/TOS, and transform sandboxing.

## Key Deliverables

- **Mercator Service** – Headless REST/CLI service packaged for Docker deployments.
- **Mercator SDK (`@mercator/sdk`)** – TypeScript package exposing parse and recipe APIs.
- **Recipe Store** – Pluggable persistence (local FS, S3/KV) with recipe lifecycle metadata.
- **Reviewer UI** – Tri-pane review experience runnable locally or behind auth.

## Core Workflow Objectives

1. **Agent-driven assessment** – Multi-pass loop that starts from screenshot/vision, augments via chunked HTML/markdown queries, reconciles evidence, and compiles candidate recipes within budget.
2. **Unified recipe abstraction** – Single format capturing selectors, Playwright code, transforms, tolerances, validators, metrics, and lifecycle state.
3. **Validation & scoring** – Schema-centric models (Zod) with tolerance policies, evidence matrices, and document confidence computation.
4. **Lifecycle management** – Promotion states (`draft → candidate → canary → stable → retired`), A/B canary testing, rollback safeguards, and provenance history.
5. **Lean iteration** – Ship thin vertical slices that exercise the full loop before expanding scope (products first, collections later).

## Non-Negotiable Policies

- Separate **generation** (AI-assisted) from **execution** (deterministic recipe run).
- Enforce **budget limits** (queries, time) and **policy gates** (Playwright allowance, robots compliance).
- Maintain **sandboxed transforms** with deterministic behavior and no network side effects.
- Preserve **auditability**: reviewer decisions, metrics, artifacts retained per policy.

This vision document should remain stable. Update only when business goals or success criteria change materially; iteration-specific plans belong in the delivery documents.
