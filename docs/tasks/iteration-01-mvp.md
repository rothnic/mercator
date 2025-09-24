# Iteration I01 — Stubbed MVP Loop

## Goal
Deliver the smallest possible Mastra-powered loop: a stubbed `getHtml` tool, a scraper agent that emits a Cheerio IIFE, a runner that executes and validates the script, and lightweight persistence for domain knowledge + history. Every follow-up slice builds on top of this baseline.

## Milestones

1. **Baseline Skeleton** – Stubbed tool, deterministic scraper agent, minimal runner, history + domain knowledge persistence, and tests proving the second run reuses the stored script. ✅
2. **Script Execution Safety** – Replace the stubbed extraction result with real Cheerio execution guarded by sanitizers and timeouts. ⬜
3. **Validation Hardening** – Introduce schema-based validation (Zod or equivalent) and surface concise feedback when fields are missing. ⬜
4. **Hinting & Memory** – Store short hints in structured working memory and feed them into the scraper prompt before regeneration. ⬜
5. **Second Fixture** – Add an alternate product layout and measure reuse vs. regeneration attempts. ⬜

## Feature Backlog

| Priority | Task ID | Description | Deliverables | Status | Notes |
|----------|---------|-------------|--------------|--------|-------|
| 1 | I01-F1-T1 | Collapse the previous orchestration surface into the stub-first runner with `getHtml`, `ScraperAgent`, history logging, and domain knowledge persistence. | `apps/service/src` rebuilt around the new runner + tests covering the reuse path. | Done | Ensures the repo starts from a deterministic walking skeleton. |
| 2 | I01-F1-T2 | Document the new vertical-slice plan and align README/backlog/quality notes with the simplified approach. | Updated README, backlog, quality report, and `docs/plan/stubs-first-vertical-slice.md`. | Done | Keeps future slices consistent with the reset strategy. |
| 3 | I01-F2-T1 | Execute the generated IIFE against Cheerio (instead of returning a stubbed object) with a simple sanitizer + timeout. | `runCheerioScript` hardened, tests covering success + failure paths. | Todo | Mirrors Milestone M1 in the plan. |
| 4 | I01-F2-T2 | Replace the minimal validator with a Zod schema that reports concise issues. | Validation module upgraded, tests documenting failure messages. | Todo | Aligns with plan Milestone M2. |
| 5 | I01-F2-T3 | Persist short hints/notes in structured memory and feed them into the scraper prompt when regenerating. | Memory helpers + prompt wiring, tests covering reuse with hints. | Todo | Plan Milestones M3–M4. |
| 6 | I01-F2-T4 | Add the second fixture (`amazon_dp_alt.html`) and measure whether the stored script generalizes or needs regeneration. | Fixture + tests that run the loop twice across both layouts. | Todo | Plan Milestone M5. |

## Acceptance Criteria

- The runner can be executed locally without external services and produces deterministic history + domain knowledge artifacts.
- Running the scraper twice against the same fixture reuses the stored script and passes validation both times.
- Documentation, backlog, and quality notes stay in sync with the implemented behavior.
- Follow-up slices (execution safety, validation, hints, alternate fixtures) extend the loop end-to-end rather than introducing partially wired components.

## Agent Workflow Snapshot

The baseline workflow executes entirely within `apps/service/src/runner.ts`:

1. Load or initialize domain knowledge for the URL’s hostname.
2. Fetch HTML from the stubbed `getHtml` tool.
3. Ask the scraper agent for a Cheerio IIFE (reusing a stored script when present).
4. Execute the script, validate `{ title, price }`, and persist the script if validation succeeds.
5. Append one JSONL history line per step so the run is auditable.

Future milestones will expand this loop with real HTML execution, structured validation feedback, hints, additional fixtures, and eventually a multi-agent workflow. Each increment should be reversible and independently verifiable.
