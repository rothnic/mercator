# Iteration I01 — Mastra Bootstrap

## Goal
Stand up a clean Mastra workspace that mirrors the manual-install docs, opts into ai-sdk v5, and proves the tool/agent wiring works end to end. Future slices can then re-introduce product-specific behavior on top of this baseline.

## Milestones

1. **Workspace Reset** – Replace the legacy service app with `apps/mastra`, expose `mastra dev`, and ship a deterministic weather tool + agent. ✅
2. **Backlog Realignment** – Rewrite the iteration docs to reflect the new baseline and scope the next slices. ⬜
3. **Domain Tooling Plan** – Document how product scraping, persistence, and validation will return (leverage fixtures + shared utilities). ⬜

## Feature Backlog

| Priority | Task ID | Description | Deliverables | Status | Notes |
|----------|---------|-------------|--------------|--------|-------|
| 1 | I01-F1-T1 | Create `apps/mastra` with ai-sdk v5 compatible tooling and retire the legacy service package. | New package + README, updated root scripts, studio launches successfully. | Done | Ensures everyone starts from the same minimal baseline. |
| 2 | I01-F1-T2 | Update the iteration/backlog docs to describe the new workspace and upcoming slices. | Revised `docs/tasks/*` entries. | Todo | Blocks onboarding new workstreams. |
| 3 | I01-F2-T1 | Sketch the plan for re-introducing scraping agents, RAG resources, and validation. | Draft in `docs/plan/iterations.md` + linked tasks. | Todo | Keeps future slices coordinated. |

## Acceptance Criteria

- `pnpm dev:agents` boots Mastra Studio with the weather agent visible.
- `pnpm demo:agents` exercises the CLI entry point without requiring the studio UI.
- Documentation and backlog entries reference `apps/mastra` instead of the removed service package.

## Agent Workflow Snapshot

The baseline workflow lives entirely inside `apps/mastra/src`:

1. The `get-weather` tool returns a deterministic summary for the requested location.
2. The weather agent calls the tool whenever the user asks about conditions.
3. The exported Mastra instance wires the agent into the CLI so both the studio and the demo script share the same configuration.

Future milestones will layer in the product-specific scraping pieces as standalone slices once the backlog realignment is complete.
