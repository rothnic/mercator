import type { FixtureToolset as AgentToolset, ToolUsageEntry } from '@mercator/agent-tools';

import {
  type AgentBudget,
  type AgentToolInvocation,
  type DocumentValidationResult,
  type ExpectedDataSummary,
  type OrchestrationResult,
  type PassSummary,
  type RecipeSynthesisSummary
} from '@mercator/core/agents';

import { collectExpectedData } from './expected-data.js';
import { buildRecipeFromRuleSet } from './recipe-synthesis.js';
import type { DocumentRuleRepository } from './rule-repository.js';
import { validateRecipeAgainstDocument } from './validation.js';

const mapUsageLog = (entries: readonly ToolUsageEntry[]): AgentToolInvocation[] => {
  return entries.map((entry) => ({
    id: entry.id,
    tool: entry.tool,
    input: entry.input,
    timestamp: entry.timestamp
  }));
};

export interface DocumentSnapshot {
  readonly domain: string;
  readonly path: string;
  readonly html: string;
}

export interface OrchestrationOptions {
  readonly document: DocumentSnapshot;
  readonly toolset: AgentToolset;
  readonly ruleRepository: DocumentRuleRepository;
  readonly now?: () => Date;
  readonly budget?: Partial<AgentBudget>;
}

const createBudget = (start: number, override?: Partial<AgentBudget>): AgentBudget => ({
  maxPasses: override?.maxPasses ?? 3,
  maxToolInvocations: override?.maxToolInvocations ?? 48,
  maxDurationMs: override?.maxDurationMs ?? 5_000,
  startedAt: start
});

export const runAgentOrchestrationSlice = async (
  options: OrchestrationOptions
): Promise<OrchestrationResult> => {
  const { document, toolset, ruleRepository } = options;
  const now = options.now ?? (() => new Date());
  const start = now().getTime();
  const budget = createBudget(start, options.budget);

  if (budget.maxPasses < 3) {
    throw new Error('Agent orchestration slice requires at least three passes.');
  }

  const ruleSet = await ruleRepository.getRuleSet({ domain: document.domain, path: document.path });
  if (!ruleSet) {
    throw new Error(`No rule configuration available for ${document.domain}${document.path}`);
  }

  const executePass = async <TResult>(
    id: PassSummary<TResult>['id'],
    label: string,
    runner: () => TResult | Promise<TResult>,
    notesFactory?: (result: TResult) => readonly string[]
  ): Promise<PassSummary<TResult>> => {
    toolset.resetUsageLog();
    const started = now().getTime();
    const result = await Promise.resolve(runner());
    const completed = now().getTime();
    const usage = mapUsageLog(toolset.getUsageLog());
    const notes = notesFactory ? [...notesFactory(result)] : [];
    const status = id === 'pass-3-validation' && (result as DocumentValidationResult).status === 'fail' ? 'failure' : 'success';
    return {
      id,
      label,
      status,
      startedAt: started,
      completedAt: completed,
      notes,
      toolUsage: usage,
      result
    };
  };

  const expectedSummary = await executePass<ExpectedDataSummary>(
    'pass-1-expected-data',
    'Collect stored expectations',
    () => collectExpectedData({ ruleSet, toolset })
  );

  const synthesisSummary = await executePass<RecipeSynthesisSummary>(
    'pass-2-recipe-synthesis',
    'Synthesize candidate recipe',
    () => buildRecipeFromRuleSet({ ruleSet, now: now() }),
    () => ['Sourced field selectors from configurable rules']
  );

  const validationSummary = await executePass<DocumentValidationResult>(
    'pass-3-validation',
    'Validate candidate recipe',
    () =>
      validateRecipeAgainstDocument({
        html: document.html,
        recipe: synthesisSummary.result.recipe,
        expected: expectedSummary.result.product
      }),
    (result) =>
      result.stopReason ? [result.stopReason] : [`Document confidence ${(result.confidence * 100).toFixed(1)}%`]
  );

  const completedAt = now().getTime();

  return {
    startedAt: start,
    completedAt,
    budget,
    expected: expectedSummary.result,
    synthesis: synthesisSummary.result,
    validation: validationSummary.result,
    passes: [
      expectedSummary as PassSummary<ExpectedDataSummary>,
      synthesisSummary as PassSummary<RecipeSynthesisSummary>,
      validationSummary as PassSummary<DocumentValidationResult>
    ]
  };
};

export {
  collectExpectedData,
  buildRecipeFromRuleSet,
  validateRecipeAgainstDocument
};
export type { DocumentRuleRepository } from './rule-repository.js';
export { createInMemoryRuleRepository } from './rule-repository.js';
