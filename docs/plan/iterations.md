# Iteration Roadmap

Mercator evolves through thin vertical slices. Each iteration delivers a usable increment while laying foundations for the next step. Iteration documents should be updated when scope or acceptance criteria change; completed iterations remain as historical records.

| ID | Status  | Focus | Key Outcomes |
|----|---------|-------|--------------|
| I01 | Planned | **MVP Product Page Loop** | Agent-assisted recipe generation on synthetic product fixtures, deterministic execution path, CLI/REST thin slice, reviewer workflow stub. |
| I02 | Planned | **Real Product Pages & Canarying** | Introduce curated live URLs, canary vs stable comparison, budget tracking, improved observability. |
| I03 | Planned | **Collection Pages & Pagination** | Extend schemas/agents to handle collection cards, pagination sampling, tolerance strategies for partial visibility. |
| I04 | Planned | **Reviews & Interactivity** | Handle review sections with bounded Playwright plans or API usage, revisit queue for partial sections. |
| I05 | Planned | **Playwright-first Domains & Variants** | Policy-gated Playwright generation, variant/offer modeling, transform catalog expansion. |
| I06 | Planned | **Agent Review & Governance** | Transition stable domains to agent review, add dashboards, recipe aging triggers, tenant isolation. |

Detailed task breakdowns live in `docs/tasks`. Each iteration file (e.g., `iteration-01-mvp.md`) captures scope, milestones, and acceptance tests.
