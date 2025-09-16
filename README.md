# Mercator

Mercator is an adaptive extraction platform that generates reusable recipes for e-commerce pages and executes them deterministically. This repository will grow into a TypeScript monorepo housing the headless service, SDK, reviewer UI, and shared agent tooling.

## Getting Oriented

1. Start with the [Product Vision](docs/product/vision.md) for durable goals and deliverables.
2. Review the [System Overview](docs/architecture/system-overview.md) to understand planned components and package layout.
3. Check the [Iteration Roadmap](docs/plan/iterations.md) to see how functionality will roll out.
4. Pick the next task from the [Task Backlog](docs/tasks/index.md) and follow the [Task Working Agreement](docs/tasks/README.md).
5. Consult the [Architecture Decisions](docs/decisions/README.md) for rationale behind major choices.

## Contributing

- Follow the task priority order; do not skip ahead without approval.
- Update task status directly in the task tables when starting or finishing work.
- Record new architectural choices as ADRs in `docs/decisions/`.
- Keep documentation synchronized with implemented behavior to minimize churn.

## Repository Layout (planned)

```
apps/
  service/
  reviewer-ui/
packages/
  core/
  sdk/
  agent-tools/
fixtures/
```

Actual directories will be created as tasks in Iteration I01 are completed.
