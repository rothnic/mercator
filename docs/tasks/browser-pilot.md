# Browser-tool pilot

Base source: Mercator main `48d08e55da9d4d27991b10bc8f7f8436f81da2e8`. Reviewed plan: `mercator-tool-refinement-proposal.md`, October 2, 2026.

- Complete: isolated typed detail tool, dynamic fixture, independent semantic expectations, explicit coverage, bounds and unsupported-target checks.
- Complete: two Bun checks (input validation; oracle rejection of plausible wrong output).
- Complete: bounded native Codex worker entry point; authenticated ChatGPT status verified. Actual native execution fails under this session's filesystem/process restrictions.
- Complete: initial browser acceptance ran in GitHub Actions, passing 11/12 and failing only the deliberate changed-button drift. The formatted baseline also keeps that failure visible.
- Complete: version 0.2.0 passed all 12 browser cases. The revised selector keeps the formatted baseline's acceptance file byte-identical; no expected data or status was weakened. [Evidence](../../experiments/browser-pilot/evidence/README.md).
- Complete: GitHub Actions repository checks passed typecheck, formatting, lint, and the existing service tests; the pilot's two Bun checks also passed.
- Review fix: rejected or hung candidates now produce failed case receipts and allow later cases to run. A regression check covers both paths; tool source and independent acceptance remain unchanged.
- Complete: PR 17 merged October 3 at `da21117121cb3539eb5dc210f08e5f9737eaf8e9`; reviewed-head repository and browser checks passed, and main CI passed after merge.
- Worker integrity increment: each attempt has unique outputs and a receipt; exit zero must include a fresh valid structured result. Authentication shares the attempt budget, and inherited output pipes cannot leave the adapter waiting forever. Synthetic subprocess checks cover success, stale/malformed results, auth/build failures, missing executable, timeouts, and inherited pipes. These do not establish native model execution.
- Local strict typecheck of the revised worker and its tests passed using cached TypeScript/Bun declarations. Native execution still returned `worker_failed` on October 3 due to readonly Codex state and app-server initialization restrictions; its job-specific receipt and logs captured that failure.
- Worker increment verification: `bun test` passed 14/14 checks (11 subprocess checks plus 3 tool checks); local strict TypeScript and formatter/lint checks passed. Luna 6 re-review found no remaining blocker after the inherited-pipe fix. Root pnpm checks still lack local dependencies; GitHub Actions is the repository gate.
- Pending: qualify Libretto against the same task and model budget, after ordinary browser baseline runs.
- Pending: a real read-only website contract and narrow canary.

Local quality gate attempts: `pnpm lint`, `pnpm test`, and `pnpm typecheck` cannot run without installed root dependencies. The package-manager bootstrap also cannot write its normal tools directory here; disabling its version-management bootstrap does not supply missing executables. Shell GitHub DNS and network listening are unavailable. These environment limits are recorded rather than treated as passed checks.

Before production admission: supervise complete worker process trees; protect independent oracles through actual permissions; preserve job budgets/checkpoints across quota deferral; authorize site/account context; bind artifacts to exact versions; add centrally owned promotion and repair deduplication. These are follow-up requirements, not capabilities of this pilot.
