# System Overview

Mercator is delivered as a TypeScript monorepo that houses four primary products sharing a unified recipe abstraction.

```
apps/
  service/        # REST + CLI entrypoints (Docker target)
  reviewer-ui/    # HITL tri-pane application
packages/
  sdk/            # @mercator/sdk client package
  core/           # shared domain models, recipe engine, transforms, tolerances
  agent-tools/    # query/vision tool shims exposed to the agent loop
```

## Core Components

### 1. Agent Orchestration Loop
- **Coordinator** manages the multi-pass workflow (vision → HTML retrieval → reconciliation) and enforces budgets/stopping criteria.
- **User Proxy, Extractor, Validator, Reviewer, Storage** agents share a typed context and communicate through deterministically logged tool invocations.
- **Tool layer** exposes screenshot OCR, chunked HTML queries, JSON-LD extraction, transform catalog lookups, and provenance recording.

### 2. Recipe Abstraction
- Single schema representing selector, Playwright, or hybrid extraction strategies.
- Fields include steps, transforms, validators, tolerances, provenance, metrics, lifecycle state, and version metadata.
- Stored in the **Recipe Store** with pluggable adapters (`LocalFS`, `S3`, `KV`).

### 3. Execution Engine
- Deterministic runner that applies a promoted recipe to HTML/markdown inputs.
- Uses shared transform & validation libraries to normalize output and compute confidence.
- Enforced separation from generation path; no AI or agent interaction during execution.

### 4. Service & CLI
- REST endpoints (`/recipes/generate`, `/recipes/test`, `/recipes/promote`, `/parse`, `/review/submit`) expose orchestration and lifecycle operations.
- CLI mirrors service operations for local workflows and testing.
- Docker image bundles the service with recipe store adapters and policy configuration.

### 5. Reviewer UI
- Tri-pane interface displaying screenshot overlays, DOM snippets, and JSON diffs.
- Supports approval/regression, tolerance adjustments, and provenance review.
- Communicates with the service via authenticated APIs.

### 6. SDK (`@mercator/sdk`)
- Client for recipe execution and lifecycle operations.
- Provides TypeScript types (Zod schemas), parse helpers, and recipe validation utilities.
- Published to npm with generated API docs.

## Cross-Cutting Concerns

- **Policy Gate** – central module controlling Playwright usage, robots/TOS compliance, tenant-specific limits, and logging denials.
- **Observability** – metrics pipeline capturing coverage, confidence, latency, token/query budgets, promotion funnel, and rollback alerts.
- **Transform Sandbox** – deterministic transform execution with no network or filesystem side effects; namespaced builtins vs custom transforms.
- **Data Retention & Audit** – artifact storage (screenshots, HTML, JSON) with retention windows and access controls.

## Architectural Principles

1. **Thin vertical slices** – every iteration delivers an end-to-end scenario touching agents, recipe compilation, validation, review, and execution.
2. **Composable services** – share logic through packages; keep apps lightweight adapters.
3. **Deterministic interfaces** – all agent tool calls and recipe executions are deterministic and loggable, enabling replay and regression tests.
4. **Extensibility** – adapters for storage, policies, and tools use dependency injection so new backends can be added without rewriting workflows.

Detailed iteration plans, component boundaries, and task-level work are tracked in the delivery and task documents.
