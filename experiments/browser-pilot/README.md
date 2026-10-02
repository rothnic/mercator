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

The `selector drift` case deliberately failed with version 0.1.0: the fixture changes the detail button while semantic records stay unchanged. CI verified 11 passes and that one failure. Version 0.2.0 recognizes the two demonstrated read-action labels; record identity and field checks are unchanged. The acceptance file is byte-identical to the formatted baseline. The candidate still requires a passing replay and review before use outside this fixture.

To launch one subscription-backed coding attempt on an owned worker:

```sh
codex login status
bun run worker.ts
```

The worker uses native Codex authentication, refuses API-key overrides, requests structured output, and terminates its Codex process after ten minutes. `MERCATOR_MODEL` optionally selects an account-supported model. It has no automatic promotion, retry scheduler, or local-model fallback. Candidate results still need replay/review. The process deadline does not certify termination of every descendant process; production supervision remains follow-up work.

Local verification in ChatGPT Work Mode: two Bun tests pass and the tool, evaluator, and replay pass a strict TypeScript check with cached tooling. Shell GitHub DNS, loopback listening, native Codex initialization, and headless Chromium are blocked by this execution sandbox. A Chrome connection exists, but inline `data:` fixture navigation is blocked by its URL policy. No browser acceptance result is claimed from those attempts. The dedicated GitHub Actions workflow supplies the verified normal HTTP/Chromium test path without coding-provider credentials.

Use `results/` for local logs; it is ignored. Share only reviewed summaries. Keep site cookies and coding-account secrets out of repository artifacts.
