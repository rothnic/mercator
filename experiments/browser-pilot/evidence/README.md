# Baseline and repair evidence

| Candidate | CI replay | Outcome |
| --- | --- | --- |
| 0.1.0 formatted baseline | [Run 37040044966](https://github.com/rothnic/mercator/actions/runs/37040044966) | 11 passed; only the changed-button case failed |
| 0.2.0 repaired tool | [Run 37040300085](https://github.com/rothnic/mercator/actions/runs/37040300085) | All 12 passed |
| Repository checks for repaired source | [Run 37040300076](https://github.com/rothnic/mercator/actions/runs/37040300076) | Typecheck, formatting, lint, and tests passed |

The mirrored [baseline receipt](baseline.json) and [refined receipt](refined.json) record source/evaluator hashes, per-case outcomes, timing, Chromium version, and zero routine inference. Both use acceptance SHA-256 `17aef90f71e7784bcd116de0ce610136dd0a06140b052b49641b72a550bceaed`. The repaired tool hash is `379b792b7e2ff0b47be821e699d2a59d414bb4284e4ef7df0e43e0c9ae4bf5a2`.

The repair changes the supported read-action labels and tool version. It leaves expected record data, failure statuses, limits, and the evaluator unchanged. These are controlled-fixture outcomes, not estimates of real-site reliability or a benchmark of autonomous coding. The coding work in this turn used ChatGPT Work Mode with a Luna 6 acceptance review; native `codex exec` initialization remained blocked here. That distinction matters before claiming an unattended subscription-worker loop.
