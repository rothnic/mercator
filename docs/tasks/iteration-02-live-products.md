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

Revisit and expand these tasks after closing Iteration I01.
