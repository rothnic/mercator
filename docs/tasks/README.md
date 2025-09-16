# Task Working Agreement

- **Source of truth** – Tasks live under `docs/tasks`. Do not duplicate requirements elsewhere. Update statuses directly in the task tables.
- **Statuses** – Use `Todo`, `In Progress`, `Blocked`, or `Done`. Leave tasks in `Todo` unless you are actively working on them.
- **Picking work** – Start with the earliest iteration that still has `Todo` tasks. Within an iteration, follow the priority order listed in each feature table.
- **Dependencies** – Respect the `Depends On` column before starting a task. If a dependency is unclear, clarify it in the task notes rather than proceeding.
- **Scope changes** – If you uncover missing work, create a new task with a clear description and link it from the `Notes` field. Avoid editing higher-level docs unless the product direction changes.
- **Deliverables** – Every task specifies the expected artifacts (code, tests, docs). Use them as acceptance criteria for PR reviews.

When closing a task, add a brief changelog link or PR number in the `Notes` column for traceability.
