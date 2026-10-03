# Subscription browser-tool pilot

This isolated experiment adds one reusable tool beside Mercator's current service. It does not integrate or replace the existing generated-script runner.

Requirements: Bun 1.3.10+, the pinned Playwright package, Chromium, and permission to bind a loopback fixture server. The build worker additionally requires Codex already signed in with ChatGPT; replay requires no model credentials.

```sh
cd experiments/browser-pilot
bun install --ignore-scripts
bunx --package playwright@1.58.2 playwright install chromium
bun test
bun run replay.ts
```

On Linux, Chromium may need system dependencies; use the official Playwright `install --with-deps chromium` command where system package installation is permitted. If using an existing compatible Chromium, set `MERCATOR_CHROMIUM` to its executable path. Do not change security settings to force the pilot to run.

The replay starts an ephemeral HTTP fixture on loopback, allows browser requests only to that origin, and uses a clean context per case. Fixed independent expectations check dynamic identity, replaced rows, duplicate boundaries, collection limits, wrong/stale records, timeouts, unsupported URLs, malformed cursors, and a reordered layout. Receipts include source/evaluator hashes and zero routine inference. This small suite is a functional pilot, not a reliability estimate.

The `selector drift` case deliberately failed with version 0.1.0: the fixture changes the detail button while semantic records stay unchanged. CI verified 11 passes and that one failure. Version 0.2.0 recognizes the two demonstrated read-action labels; record identity and field checks are unchanged. It passed all 12 cases with the acceptance file byte-identical to the formatted baseline. See [baseline and repair evidence](evidence/README.md). This verifies the controlled fixture contract; it does not qualify a real website or production service.

To launch one subscription-backed coding attempt on an owned worker:

```sh
codex login status
bun run worker.ts
```

The worker uses native Codex authentication, refuses API-key overrides, and requests structured output. Every attempt has its own private `results/job-*` directory with a receipt and logs; successful preflight also records a task hash. `candidate_available` requires exit zero and a fresh result matching the four-field build-result contract. Old shared files, missing output, invalid JSON, wrong types, or extra fields cannot satisfy it. The model's `checks_run` entries remain claims; independent replay/review still decides acceptance.

Authentication has a maximum thirty-second process budget and shares the ten-minute execution budget with the build. Timeout sends SIGTERM, with up to one second of shutdown grace before SIGKILL and a bounded return. After regular direct process exit, output pipes have 250 ms to close; inherited pipes that remain open cause a failed receipt. This bounds the adapter's wait, while full descendant supervision and filesystem I/O limits remain host responsibilities. A thirty-second authentication timeout includes a stage-specific reason in its receipt.

`MERCATOR_MODEL` optionally selects an account-supported model. There is no automatic promotion, retry scheduler, or local-model fallback. Separate output directories do not isolate candidate source edits or protect the evaluator; run one attempt at a time until an independent workspace and supervisor are qualified.

| Status | Meaning |
| --- | --- |
| `candidate_available` | Fresh structured summary is available for independent review |
| `invalid_result` | Process exited zero but its result is missing or fails the contract |
| `auth_required` | Preflight did not establish ChatGPT authentication |
| `configuration_error` | API-key overrides were supplied |
| `deadline_exceeded` | Authentication or execution exhausted its process budget |
| `worker_failed` | Native execution, output draining, or setup failed |

On the MacBook, run the documented commands in an ordinary Terminal/Codex session with access to its own Codex state directory and process startup. A logged-in account alone does not remove a managed session's filesystem/process restrictions. Do not change sandbox settings to force this session to run. If the native worker fails, inspect the printed job directory's receipt and stderr before attempting another login.

Immediate next steps: run the native subscription worker on an owned machine where Codex, loopback listening, and Chromium work; choose one real read-only listing/detail task with a locked outcome contract; then compare ordinary browser authoring with Libretto using the same provider and effort budget. No second subscription, Mastra service, Gas City scheduler, or P40 setup is required for those steps.

Local verification in ChatGPT Work Mode: two Bun tests pass and the tool, evaluator, and replay pass a strict TypeScript check with cached tooling. Shell GitHub DNS, loopback listening, native Codex initialization, and headless Chromium are blocked by this execution sandbox. A Chrome connection exists, but inline `data:` fixture navigation is blocked by its URL policy. No browser acceptance result is claimed from those attempts. The dedicated GitHub Actions workflow supplies the verified normal HTTP/Chromium test path without coding-provider credentials.

The review adds a third tool check for rejected and hung candidates: each becomes a failed receipt, later cases continue, and the harness closes that case's browser context. Browser startup or fixture-server failure remains an infrastructure error. Worker subprocess checks use a temporary synthetic Codex executable with no path fallback to the real CLI; they establish adapter behavior, not successful native subscription inference.

Use `results/` for local logs; it is ignored. Share only reviewed summaries. Keep site cookies and coding-account secrets out of repository artifacts.
