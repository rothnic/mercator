# Mastra Scraper — Stubs-First Vertical Slice Plan

> **Status:** Legacy reference. The active workspace now lives in `apps/mastra` with a weather agent baseline. Update or replace this plan once the backlog realignment (Iteration I01) is complete.

> **Goal:** Build a tiny end-to-end proof using **Mastra** with one agent, one stubbed tool, and minimal memory — then iterate in tiny, reversible slices. Avoid big-bang foundations. Prove the loop works first, expand later.

---

## 1) Guiding Principles

- **Walking skeleton / tracer bullet / vertical slice.** Each change touches agent → tool → memory → history.
- **Stubs before real integrations.** Start with a tool that **returns stub HTML** for a URL. Replace with real fetch/playwright **later**.
- **Keep types minimal.** Use bare JS objects or trivial Zod until behaviors stabilize.
- **Short prompts, temp=0.** Deterministic, tiny instructions; no verbose context.
- **Every step produces an artifact.** (a code string, a tiny JSON result, a one-line history entry, or a memory update)

---

## 2) What Mastra gives us (and how we’ll use it)

- **Agents**: LLMs with tool-calls & memory. Start with one **Scraper Agent**, later add an **Orchestrator Agent**.
- **Tools**: Small functions with Zod I/O. We’ll keep I/O **tiny** and logic in utilities.
- **Memory**: Working/persistent stores. We’ll keep a tiny **domain knowledge** JSON per `resourceId` and a **history.jsonl**.
- **Workflows**: Optional. When we need predictable sequencing (multi-agent), we’ll add a **simple workflow** to orchestrate.

---

## 3) The Absolute Minimum (Hello World)

**Outcome in <15 minutes:**

1. Run a script.
2. An agent calls one tool (`getHtml`).
3. Agent generates an **IIFE string**.
4. We **don’t execute** yet — just log it, validate a **stub result** `{ title, price }`, and write memory + history.
5. Run again to prove memory reuse (e.g., prompt includes: “reuse last script”).

### Artifacts (minimum)

- A runner script (entry point) that coordinates the tiny flow.
- One **Scraper Agent** that asks for an IIFE string.
- One tool: **getHtml** (stubbed now, real later).
- Minimal memory access helpers (load/save) for domain knowledge.
- A tiny validator function for `{ title, price }`.
- A history appender that writes one concise JSON line per step.

### Organization Guidelines

- **Keep function logic separate** from tool definition. Tools should be thin wrappers over small, testable functions.
- **Group tools** by purpose with **one tool per file**. Keep each file short.
- **Separate get/set operations** into **different tools** (e.g., `domainKnowledgeGet` vs `domainKnowledgeSet`; do not combine).
- **Keep prompts tiny and stable**; prefer adding parameters over renaming tools.
- **Put fixture data for testing in its own directory**, separate from runtime data/output.

### Tool: getHtml (stub, minimal)
- **Stable name:** `getHtml` (do **not** rename; evolve via params)
- **Input:** `{ url: string }`
- **Output:** `{ html: string }`
- **Behavior (initial stub):** If URL includes `amazon.com/dp/`, return a small embedded HTML string (or read from a fixture). Else return a tiny generic HTML snippet. Later, **extend** via optional params (e.g., `{ maxChars, lineStart }`) for chunked reads—**without changing the tool name**.

###### Memory (domain knowledge) — minimal shape

```json
{
  "resourceId": "amazon.com",
  "scripts": [
    { "pathRegex": "^/dp/", "script": "(function(){return {title:'X',price:'$1.00'}})()", "lastUpdatedAt": "2025-09-23T...Z" }
  ]
}
```

### History JSONL line (one per step)

```json
{"t":"2025-09-23T...Z","step":1,"actor":"scraper","action":"getHtml","outcome":"returned amazon_dp_min.html (1.2KB)"}
```

---

## 4) Minimal Flow (Run 1)

1. **runner.ts**
   - Parse `url` + `resourceId` (hostname).
   - Append history: `start`.
   - Load domain knowledge file if exists; else create `{ resourceId, scripts: [] }`.
2. **Agent (scraper)** calls **getHtml** → receives HTML string.
3. Agent **generates an IIFE string** (prompt: “Return `{ title, price }` using plain DOM.”). We **do not execute yet**.
4. **Stub result**: set `raw = { title: "Fixture Title", price: "$12.34" }`.
5. **validateMinimal(raw)**: string checks only.
6. If OK and no saved script yet, **persist** `{ pathRegex: '^/dp/', script }` in domain knowledge.
7. Append concise history lines for each step.

**Run 2:** Same URL. We detect existing script → agent prompt includes: “Prefer same anchors as last run.”

---

## 5) Tiny Milestones (each is end-to-end)

### M1 — Execute IIFE on stub HTML (JSDOM)

- Add `evalHtml.ts` (JSDOM). Execute IIFE string against `html`.
- Replace stub result with real evaluation. Timeout + try/catch.
- Keep validation minimal.

### M2 — Introduce Zod (tiny)

- Replace `validateMinimal` with Zod schema for just `{ title, price }`.
- Use `safeParse`; map first 1–3 issues; write to history.

### M3 — Add one more tool: summarizeHtml

- `summarizeHtml({ html }) -> { hints: string[] }` (e.g., found `$` near `<span id="price">`).
- Agent includes `hints[0]` in the codegen prompt.

### M4 — Memory-aware prompt

- If a script exists, add a **one-liner** to the system prompt: “Use anchors similar to last script.”
- If eval fails, record `lastScore: 0` and a short `notes` item.

### M5 — Second fixture

- Add `amazon_dp_alt.html` with price in a different spot. Confirm reuse or regeneration under 2 attempts.

### M6 — Extend `getHtml` to support real HTTP fetch (optional)

- Add an internal flag to make `getHtml` call a real HTTP fetch path instead of the stub. Keep the stub path available for deterministic tests. Maintain backward-compatible inputs/outputs; **do not rename** the tool.
- Replace `getHtml` with `getHtml` (no JS execution, static-only). Keep stub tool available behind a flag.

### M7 — Playwright (optional) → later in-page eval

- Use Playwright to get `page.content()` only. Keep JSDOM eval.
- Later add `runInPage` for dynamic content, guarded by sanitizer + timeout.

> At every milestone, **run end-to-end** and write 3–5 history lines. If a slice grows, roll it back and re-slice.

---

## 6) Two-Agent Collaboration (when ready)

**Option A: Simple workflow orchestrating two agents**

- **Orchestrator Agent** (decides: reuse or regenerate; may call `summarizeHtml`).
- **Scraper Agent** (only codegen + execute).
- A **Mastra workflow** with 2–3 steps: load memory → get HTML (stub/real) → (optional summarize) → codegen → eval → validate → persist.

**Option B: One agent + tools**

- Keep as one agent longer; expose tools for memory get/set and html get/summary.
- Switch to workflow when branching logic grows.

**Team rules (keep it simple):**

- The orchestrator writes the history lines. The scraper only returns `{ code, raw }`.
- All prompts stay **short**; temperature=0.

---

## 7) Prompts (short, deterministic)

**Scraper system:**

- “You generate exactly one JavaScript IIFE string. No imports/logs. Return `{ title, price }` (strings). Use `document.querySelector` or `getElementById`. If a value is missing, return an empty string.”

**Scraper user:**

- A **short** html excerpt (≤3–5KB) + 1 hint (if any) + single instruction: “Produce the IIFE now.”

**Orchestrator system (later):**

- “Decide reuse vs regenerate; if regenerate, ask Scraper for a new IIFE. Append a concise history note after each step.”

---

## 8) Testing Strategy (micro, not heavy)

- **Smoke run scripts** in `examples/` that print the 3–5 history lines.
- **Single assertion** per milestone (e.g., price contains `$`, history length increased by ≥3).
- Unit tests only **after** a milestone is stable (e.g., JSDOM eval; simple Zod).

---

## 9) What can block us (and how we avoid it)

- **Over-typing early** → keep Zod minimal; plain objects OK at first.
- **Verbose prompts** → keep them short; temperature=0.
- **Big foundations (Playwright, complex tools)** → defer; start with `getHtml` and JSDOM.
- **Context bloat** → store/refer to short memory notes; avoid long message history.
- **Fragile eval** → sanitize and timeout; if eval fails, record and fallback to regeneration.

---

## 10) Ready-to-Build Checklist (today)

- [ ] `getHtml` tool reading `fixtures/amazon_dp_min.html`
- [ ] Scraper Agent that returns an IIFE string
- [ ] `runner.ts` that logs: start → getHtml → codegen → validate(stub) → persist → done
- [ ] Memory file created & read on second run
- [ ] History JSONL with ≤120-char outcomes

Once this skeleton is proven, iterate M1→M7, always end-to-end, always tiny.

---

## 11) Key Challenges & Tiny POCs Roadmap (in rising complexity)

> Scope: prove the **uncertain** parts with tiny, end-to-end slices. Each item has a **Why**, a **Tiny POC**, **Done criteria**, **Next rung**, and any **Mastra notes** (memory/workflow).

### 11.1 Large HTML vs Context Window (chunking/targeting)

**Why:** Real PDP HTML often exceeds safe prompt sizes; agents must work from **excerpts** not whole pages.

**Tiny POC:**

- Keep `getHtml({ url })` returning a large fixture string.
- Add `htmlWindow({ html, maxChars, strategy }) → { excerpt }` utility (not a tool yet) with strategies: `head`, `tail`, `around('<span id="price')'` (simple index-based windowing).
- Feed only `{ excerpt }` to Scraper Agent for codegen (Cheerio).

**Done:** Agent produces working extractor based on excerpt; `runCheerioScript` returns `{ title, price }`.

**Next rung:** Promote `htmlWindow` into a tool with params; add `strategy:'keywords'` that takes `['price','title']` and returns 2–3 windows.

**Mastra notes:** No special API—just keep the tool **tiny** with stable name; store the chosen strategy in domain knowledge for reuse.

---

### 11.2 Orchestrator + Sub-Agents (handoffs & feedback)

**Why:** We’ll ultimately want an **Orchestrator** to decide reuse vs regenerate, request hints, and enforce validation.

**Tiny POC:**

- Keep a single Scraper Agent for codegen.
- Implement a **minimal Orchestrator** as imperative code in `runner` that:
  1. tries reuse from domain knowledge,
  2. on failure calls Scraper Agent,
  3. on success persists script and appends concise history (one line per step).

**Done:** Reuse path triggers without calling the Scraper; regenerate path calls Scraper once and persists.

**Next rung:** Promote Orchestrator to a **Mastra workflow** with two agents (Orchestrator & Scraper). Orchestrator writes history; Scraper only returns `{ code, raw }`.

**Mastra notes:** Use **resource-scoped working memory** to surface short, persistent hints per domain (see §11.5).

---

### 11.3 Shared State Across Sub-Agents (domain knowledge)

**Why:** Multiple agents must see the **same domain knowledge** (prior scripts, anchors, notes) without context bloat.

**Tiny POC:**

- Tools: `domainKnowledgeGet` / `domainKnowledgeSet` (separate files, tiny I/O).
- Shape (POC): `{ resourceId, scripts:[{ pathRegex, script, lastUpdatedAt }], notes?: string[] }`.
- The Orchestrator reads once at start and writes once at end.

**Done:** Second run reuses the stored script; history shows a 1-line note like `used prior ^/dp/ script`.

**Next rung:** Add `anchors: [{ label, xpath, lastSeen }]` and `lastScore` fields based on validations.

**Mastra notes:** If using Mastra Memory for this, keep it **schema-based** (structured working memory) rather than Markdown (see §11.5).

---

### 11.4 Code Execution Safety & Determinism (Cheerio path)

**Why:** Running LLM-generated code can be brittle/unsafe.

**Tiny POC:**

- `runCheerioScript({ code, html })` runs **function body only**, not arbitrary script (via `new Function('html','cheerio', code)`), returns result.
- Minimal sanitizer: reject code containing forbidden tokens (`require(`, `import`, `process.`, `fs.`). Add a simple 3s timeout.

**Done:** Malicious or off-spec code is rejected with a single concise history line; valid code returns `{ title, price }`.

**Next rung:** add a safe wrapper that always enforces the signature and a try/catch returning `{ raw, error? }` (no throw).

**Mastra notes:** Keep this as a **tool** only if you want the Orchestrator to explicitly call it; otherwise keep it as an internal executor.

---

### 11.5 Structured Working Memory (Mastra)

**Why:** We need small, durable facts available every run (hints, last success, anchors). Markdown scratchpads drift; **schemas** are safer.

**Tiny POC:**

- Configure Mastra **resource-scoped working memory** with a **schema** (not a template) like:

```ts
const domainSchema = z.object({
  hints: z.array(z.string()).default([]),    // e.g., "price often near id contains 'price'"
  lastSuccessAt: z.string().optional(),
  lastPathRegex: z.string().optional(),
});
```

- On success, update `lastSuccessAt` + `lastPathRegex`; keep ≤3 hints total.

**Done:** On the second run, Scraper prompt includes a single hint from working memory.

**Next rung:** Move scripts/anchors into structured memory or keep them in file-backed domain knowledge; either is fine—just don’t duplicate.

**Mastra notes:** If using Mastra Memory for this, keep it **schema-based** (resource scope). Use `resourceId=hostname` and pass it with each call.

---

### 11.6 Handling Invalid/Partial Model Output

**Why:** LLMs sometimes return broken code or empty fields.

**Tiny POC:**

- Keep codegen prompt strict: temp=0; “function body only; return `{ title, price }`”.
- If execution fails or `{ title, price }` invalid, log 1 history line and regenerate **once** (no loops >1 try in POC).

**Done:** Either reuse succeeds or one regen attempt succeeds; otherwise exit gracefully with a short history outcome.

**Next rung:** Add a tiny evaluator tool (`evaluateExtraction`) that scores completeness (0..1) and feeds a single sentence of feedback to the Scraper Agent.

---

### 11.7 HTML Targeting Aids (hints)

**Why:** Make codegen easier with 1–2 reliable hints instead of huge context.

**Tiny POC:**

- `summarizeHtml({ html }) → { hints: string[] }` returns up to 2 strings like “found `$` near id `priceblock_ourprice`”.
- Include the **first** hint in Scraper prompt; persist it in structured memory.

**Done:** With hints, codegen success rate increases on second fixture.

**Next rung:** Add simple keyword-driven `xpathSearch` later; store top container xpath as an anchor.

---

### 11.8 Schema Growth & Versioning (don’t break tools)

**Why:** We’ll extend from `{ title, price }` to `{ imageUrl, brand, reviews… }` gradually.

**Tiny POC:**

- Keep `{ title, price }` as v1. Store `schemaVersion: 1` in domain knowledge.
- When adding a field, bump to v1.1 but keep tool I/O **backward compatible** (runCheerioScript still returns free-shape `raw`).

**Done:** Old domains with v1 still work; new ones can opt-in.

**Next rung:** Introduce Zod and validation per field as they arrive (not before).

---

### 11.9 Observability & History Discipline

**Why:** Debugging agents without clean traces is painful.

**Tiny POC:**

- JSONL history; one line per step: `{ t, step, actor, action, outcome }`.
- No raw HTML; outcomes ≤120 chars; errors summarized in one sentence.

**Done:** You can read a single run quickly; second run shows reuse.

**Next rung:** Add `runId` and `resourceId` to each line; add a summary footer line with duration + success flag.

---

### 11.10 Determinism & Prompt Hygiene

**Why:** Keep it stable so improvements are attributable.

**Tiny POC:** temp=0; short system instructions; body-only function (or a single consistent IIFE convention); truncate HTML excerpt.

**Done:** Two runs with the same inputs generate identical code.

**Next rung:** If you need variability, isolate it with a flag and record in history.

---

### 11.11 Multi-Fixture Generalization

**Why:** We must not overfit to one layout.

**Tiny POC:**

- Add `amazon_dp_alt.html`; run reuse first; if it fails, allow **one** regeneration.
- Keep anchors/hints small; persist only if validated.

**Done:** Works on both fixtures; history shows reuse vs regenerate path.

**Next rung:** Add a third site/domain fixture (e.g., `example-shop.com`) and confirm the same loop works by just changing `resourceId` and fixture.

---

### 11.12 Gradual Swap-ins (HTTP, Playwright)

**Why:** Don’t derail the proven loop.

**Tiny POC:**

- Keep `getHtml` stable; add a flag to fetch via HTTP (static HTML only), default **off**.
- Later, add Playwright to produce HTML, but still execute code with Cheerio in Node for test determinism.

**Done:** Same API, different internals.

**Next rung:** Only after stability, consider in-page evaluation.

---

## 12) Reference Notes (Mastra Working Memory quicklift)

- **Thread vs Resource scope:** we want **resource-scoped** so a domain’s notes persist across runs/threads.
- **Schema-based memory:** prefer a small Zod schema (e.g., `{ hints: string[], lastSuccessAt?: string }`) over Markdown templates.
- **Passing resourceId:** always include the **hostname** (e.g., `amazon.com`) as `resourceId` on agent/workflow calls so memory attaches correctly.
- **Update pattern:** Orchestrator (or runner) calls `updateWorkingMemory` with a concise, bounded object; agents read it automatically on subsequent steps.
- **Keep it short:** bound arrays (≤3 hints), avoid verbose narratives.

> The above aligns with Mastra docs on **Working Memory** (schema mode, resource scope).

---

## 14) Project Goals, KPIs, and Experimentation Plan

### Core Goal (Minimal Starting Point)

Establish the **simplest end-to-end loop** that proves the agent+tools+memory concept:

- Give the **Scraper Agent** the **entire HTML** (from `getHtml` stub) and a **single validator** `{ title, price }`.
- The agent **generates Cheerio code**, we **execute** it (`runCheerioScript`), **validate**, and **persist** the script to domain knowledge.
- If invalid, allow **one** refinement cycle with concise feedback; otherwise stop.
- On next run, **reuse** the stored script before regenerating.

### What We’ll Learn From the Baseline

- Can one agent reliably produce a working extractor from full HTML?
- Does persisted script reuse meaningfully reduce steps/cost on re-runs?
- Where does it fail (invalid code, wrong selectors, brittle assumptions)?

### KPIs (compare strategies apples-to-apples)

- **Field accuracy**: exact match for `title`, `price` (per fixture). Later extend to more fields.
- **Success rate**: % runs that pass validation without manual intervention.
- **Attempts to success**: 1st try vs 2nd try (refine once). Target ≤1.3 avg.
- **Latency**: wall time per run (exclude I/O where possible) and **steps** count.
- **Token usage / cost**: input + output tokens per run.
- **Reuse rate**: % runs where prior script worked w/o regeneration.
- **Robustness**: passes across **N fixtures** per domain (layout variation). Track failures by reason (empty select, wrong node, parse error).
- **Determinism**: identical outputs for same inputs (temp=0); drift = % mismatched.
- **Safety**: % runs blocked by sandbox/sanitizer (forbidden tokens) — should be ~0.

> KPIs are logged per run in a compact `experiments` JSONL (strategyId, runId, resourceId, fixtureId, seed, metrics).

### Experiment Harness (small, swappable)

- **Strategy descriptor** per run: `{ strategyId, tools: ['getHtml','runCheerioScript','xpathSearch?','htmlWindow?'], promptVariant: 'baseline|hinted', params: {...} }`
- **Runner** iterates fixtures × strategies, logs KPIs per run to `experiments.jsonl`.
- **Repro:** seed and temp=0; consistent fixtures; identical validation per field.
- **One toggle at a time**: change one thing per strategy (e.g., add XPath tool, change prompt hinting).
- **Consistent fixtures**: the same set across strategies; no Playwright in experiments until later.

### Baseline Loop (pseudo)

```ts
const html = (await getHtml({ url })).html
const prior = await domainKnowledgeGet({ resourceId })
const code = prior.script ?? await scrapeAgent.codegen({ html, hint: prior.hint })
const { raw } = await runCheerioScript({ code, html })
const { ok, issues } = validateMinimal(raw)
if (!ok && !prior.script) {
  const refine = await scrapeAgent.refine({ html, feedback: issues.join(', ') })
  const out = await runCheerioScript({ code: refine.code, html })
  if (validateMinimal(out.raw).ok) await domainKnowledgeSet({ script: refine.code })
} else if (ok && !prior.script) {
  await domainKnowledgeSet({ script: code })
}
```

---

## 15) Approach Catalog (to be tested after baseline)

We’ll iterate on the baseline with **small, swappable** strategies. Each item should be implemented as:

- a **tiny tool** (stable name, optional params),
- a **prompt variant** (short, temp=0), and
- a **recorded strategyId** for KPI comparison.

### A. XPath/Keyword Targeting

**Idea:** Search DOM for keywords (e.g., `price`, `title`, `rating`) via XPath or CSS; **summarize** hits and propose **anchors**.

- Tool: `xpathSearch({ html, xpath, limit }) → { nodes: [{ xpath, textPreview }] }`
- Utility: **climb** from matches to nearest stable identifier (id/class), **dedupe** similar nodes.
- Prompt hint: “Price often near `<span id="price...">` (n=12 matches). Use closest ancestor with unique id/class.”
- KPI focus: attempts to success, robustness on alt fixtures.

### B. Neighborhood Summaries

**Idea:** For each candidate anchor, return a **compact neighborhood** (outerHTML trimmed / text-only) for the agent to consider.

- Tool: `summarizeNeighborhood({ html, xpath, radius }) → { snippet }`
- Keep snippets ≤ 400–600 chars to avoid context bloat.

### C. Heuristic Anchors (non-LLM prepass)

**Idea:** Before calling the agent, run simple heuristics:

- **Price regex** near elements with ids/classes containing `price`, `ourprice`, `sale`, etc.
- **Title** preference order: `h1`, meta `og:title`, `<title>`.
- Save top 1–2 anchors in domain knowledge for reuse.

### D. Multi-Agent Orchestration (when needed)

**Idea:** Orchestrator Agent coordinates:

- **Phase 1:** reuse or regenerate
- **Phase 2:** (optional) request hints via `xpathSearch`/`summarizeHtml`
- **Phase 3:** codegen → execute → validate → persist
  Shared state: resource-scoped working memory and domain knowledge.

### E. Excerpting (large HTML)

**Idea:** Provide only windows of HTML.

- Tool: `htmlWindow({ html, strategy, maxChars, keywords? }) → { excerpts: [..] }`
- Strategies: `head`, `tail`, `keywords` (n windows around matches).

### F. DOM Diff & Consensus

**Idea:** Run extractor across multiple fixtures; when failures arise, auto-suggest **generalized selectors**.

- Tool: `compareSelectors({ fixtures, selector }) → { successRate }`
- Agent prompt variant: “Prefer selectors that work on 2+ variants.”

### G. Visual-First (later)

**Idea:** Model extracts `{ title, price }` from a **full-page screenshot** (or screenshot + DOM map). Complexity high; defer.

- Tool (future): `getScreenshot({ url }) → { image }`
- KPI focus: accuracy vs text-DOM approaches.

### H. Reliability Fallbacks

**Idea:** Chain simple fallbacks before codegen:

- Try canonical meta tags, `og:title`, microdata before calling the model.
- If these pass validation, skip codegen.

### I. Schema Growth

**Idea:** Add fields gradually (imageUrl, brand, breadcrumbs, reviews). Never rename tools; evolve params.

---

## 16) Comparing Strategies (clean A/B harness)

- **Strategy config:** `{ strategyId, tools: ['getHtml','runCheerioScript','xpathSearch?','htmlWindow?'], promptVariant: 'baseline|hinted', params: {...} }`
- **Runner** iterates fixtures × strategies, logs KPIs per run to `experiments.jsonl`.
- **Repro:** seed and temp=0; consistent fixtures; identical validation per field.
- **Readout:** simple script prints per-strategy summary: success rate, attempts, avg tokens, reuse %, and top failure reasons.

This keeps us honest: one minimal baseline, then targeted, measurable experiments—no big-bang rewrites, no tool renames, and every step stays end-to-end and testable.
