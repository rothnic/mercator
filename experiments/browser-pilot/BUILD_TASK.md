# Bounded coding attempt

Use the already signed-in ChatGPT/Codex account. Do not install a provider API key, change credentials, bypass sandboxing, push changes, or publish releases.

Improve `tool.ts` for the controlled portal in `fixture.html`. You may edit only `tool.ts`; keep its existing input/output contract. Treat `acceptance.ts`, the fixture, scripts, and result schema as read-only. Inspect the live fixture with available browser tools when possible; if unavailable, report that limit. Do not claim unrun checks passed.

The tool must retrieve the requested record, reject stale or wrong-record details, traverse replaced rows with duplicate identities, and report explicit partial coverage. It must enforce finite work/deadlines and perform no model calls during replay. A changed detail button label is structural drift, not permission to weaken identity checks.

Run `bun test` and `bun run replay.ts` when the worker can start Chromium and bind a local fixture server. Leave a reviewable candidate and return the requested structured summary. Do not change independent expectations to pass a candidate.

This prompt is an instruction boundary, not a filesystem sandbox for protected expectations. Independent evaluation and promotion happen outside this coding attempt. A production worker needs those stronger boundaries before unattended admission.
