# Browser-tool pilot

Base source: Mercator main `48d08e55da9d4d27991b10bc8f7f8436f81da2e8`. Reviewed plan: `mercator-tool-refinement-proposal.md`, October 2, 2026.

- Complete: isolated typed detail tool, dynamic fixture, independent semantic expectations, explicit coverage, bounds and unsupported-target checks.
- Complete: two Bun checks (input validation; oracle rejection of plausible wrong output).
- Complete: bounded native Codex worker entry point; authenticated ChatGPT status verified. Actual native execution fails under this session's filesystem/process restrictions.
- Complete: initial browser acceptance ran in GitHub Actions, passing 11/12 and failing only the deliberate changed-button drift. The formatted baseline also keeps that failure visible.
- Complete: version 0.2.0 passed all 12 browser cases. The revised selector keeps the formatted baseline's acceptance file byte-identical; no expected data or status was weakened. [Evidence](../../experiments/browser-pilot/evidence/README.md).
- Complete: GitHub Actions repository checks passed typecheck, formatting, lint, and the existing service tests; the pilot's two Bun checks also passed.
- Pending: qualify Libretto against the same task and model budget, after ordinary browser baseline runs.
- Pending: a real read-only website contract and narrow canary.

Local quality gate attempts: `pnpm lint`, `pnpm test`, and `pnpm typecheck` cannot run without installed root dependencies. The package-manager bootstrap also cannot write its normal tools directory here; disabling its version-management bootstrap does not supply missing executables. Shell GitHub DNS and network listening are unavailable. These environment limits are recorded rather than treated as passed checks.

Before production admission: supervise complete worker process trees; protect independent oracles through actual permissions; preserve job budgets/checkpoints across quota deferral; authorize site/account context; bind artifacts to exact versions; add centrally owned promotion and repair deduplication. These are follow-up requirements, not capabilities of this pilot.
