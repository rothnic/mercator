# Iteration I02 — Live Product Pages & Canarying (Draft)

Status: **Draft** – Do not start until Iteration I01 is complete and reviewed. Update this file with refined scope once MVP learnings are available.

## Tentative Objectives

- Run the generation/validation loop against a curated set of live product URLs with varying complexity.
- Introduce canary testing comparing candidate recipes to the current stable recipe.
- Track budget utilization (query counts, latency) and surface in logs/metrics.
- Harden policy gates (Playwright allowance, robots compliance) and observability hooks.

## Draft Feature Backlog (subject to change)

| Priority | Task ID | Description | Depends On | Status | Notes |
|----------|---------|-------------|------------|--------|-------|
| 1 | I02-F1-T1 | Collect 10–15 deterministic live product URLs with stored snapshots (HTML, screenshot) and document expected outputs. | Completion review of I01 | Todo | Requires compliance review. |
| 2 | I02-F1-T2 | Extend fixture loader to support remote fetch with caching and policy checks. | I02-F1-T1 | Todo | Ensure robots.txt respected. |
| 3 | I02-F2-T1 | Implement canary runner comparing candidate vs stable recipes with coverage/confidence metrics. | I01-F5-T2 | Todo | Output promotion decision rationale. |
| 4 | I02-F2-T2 | Surface budget + confidence metrics via structured logs and optional JSON report. | I01-F6-T3 | Todo | Feed into reviewer UI later. |
| 5 | I02-F3-T1 | Harden policy gate to record Playwright allowance per domain and fallback reasons. | I01-F5-T2 | Todo | No Playwright execution yet; just logging. |

### F0. MVP Cleanup (Deferred from I01)

| Priority | Task ID | Description | Depends On | Status | Notes |
|----------|---------|-------------|------------|--------|-------|
| 1 | I02-F0-T1 | Replace untyped field extraction maps with structured validation results. | I01-F4-T3 | Todo | Moved from `I01-F4-T5`; removes casts in `apps/service/src/orchestrator/validation.ts`. |
| 2 | I02-F0-T2 | Add reviewer stub endpoint returning tri-pane payload (screenshot, DOM snippet, JSON diff) for HITL. | I01-F5-T2 | Todo | Deferred from `I01-F5-T3` until after live URL support ships. |
| 3 | I02-F0-T3 | Stabilize Commander resolution for CLI/tests without `.pnpm` path assumptions. | I01-F5-T2 | Todo | Follows `I01-F5-T5`; move alias logic out of `.pnpm` paths. |
| 4 | I02-F0-T4 | Remove lifecycle history casts from the LocalFS store. | I01-F5-T1 | Todo | Successor to `I01-F5-T6`; tighten recipe store types. |
| 5 | I02-F0-T5 | Implement `E2E-Gen` and `E2E-Exec` tests covering full loop on synthetic fixture. | I01-F4-T3, I01-F5-T2 | Todo | Carried over from `I01-F6-T2` for post-MVP hardening. |
| 6 | I02-F0-T6 | Instrument minimal metrics logging (query counts, duration) and expose via structured logs. | I01-F4-T1 | Todo | Rescheduled from `I01-F6-T3`; align with observability focus in I02. |

Revisit and expand these tasks after closing Iteration I01.
