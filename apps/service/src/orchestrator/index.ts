import type { FixtureToolset as AgentToolset, ToolUsageEntry } from '@mercator/agent-tools';

import {
  type AgentBudget,
  type AgentToolInvocation,
  type DocumentValidationResult,
  type ExpectedDataSummary,
  type OrchestrationPassId,
  type OrchestrationResult,
  type PassSummary,
  type RecipeSynthesisSummary
} from '@mercator/core/agents';

import { collectExpectedData } from './expected-data.js';
import { buildRecipeFromRuleSet } from './recipe-synthesis.js';
import type { DocumentRuleRepository } from './rule-repository.js';
import { validateRecipeAgainstDocument } from './validation.js';
import { synthesizeRecipeWithAgent } from './dynamic-rule-generator.js';

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

const createBudgetGuard = (
  budget: AgentBudget,
  start: number,
  now: () => Date
) => {
  let executedPasses = 0;
  let totalToolInvocations = 0;

  const ensureDurationWithinLimit = (timestamp: number, passId: OrchestrationPassId) => {
    const elapsed = timestamp - start;
    if (elapsed > budget.maxDurationMs) {
      throw new Error(
        `Agent orchestration budget exceeded: elapsed time ${elapsed}ms exceeded limit of ${budget.maxDurationMs}ms before ${passId}.`
      );
    }
  };

  const ensureToolUsageWithinLimit = (passId: OrchestrationPassId) => {
    if (totalToolInvocations > budget.maxToolInvocations) {
      throw new Error(
        `Agent orchestration budget exceeded: tool invocations ${totalToolInvocations} exceeded limit of ${budget.maxToolInvocations} during ${passId}.`
      );
    }
  };

  const beforePass = (passId: OrchestrationPassId): number => {
    if (executedPasses >= budget.maxPasses) {
      throw new Error(
        `Agent orchestration budget exceeded: pass limit of ${budget.maxPasses} reached before ${passId}.`
      );
    }

    const timestamp = now().getTime();
    ensureDurationWithinLimit(timestamp, passId);
    ensureToolUsageWithinLimit(passId);
    return timestamp;
  };

  const afterPass = (passId: OrchestrationPassId, completedAt: number, passToolInvocations: number) => {
    executedPasses += 1;
    totalToolInvocations += passToolInvocations;

    if (executedPasses > budget.maxPasses) {
      throw new Error(
        `Agent orchestration budget exceeded: pass limit of ${budget.maxPasses} was exceeded during ${passId}.`
      );
    }

    ensureToolUsageWithinLimit(passId);
    ensureDurationWithinLimit(completedAt, passId);
  };

  return { beforePass, afterPass };
};

export const runAgentOrchestrationSlice = async (
  options: OrchestrationOptions
): Promise<OrchestrationResult> => {
  const { document, toolset, ruleRepository } = options;
  const now = options.now ?? (() => new Date());
  const start = now().getTime();
  const budget = createBudget(start, options.budget);
  const budgetGuard = createBudgetGuard(budget, start, now);

  if (budget.maxPasses < 3) {
    throw new Error('Agent orchestration slice requires at least three passes.');
  }

  const ruleSet = await ruleRepository.getRuleSet({ domain: document.domain, path: document.path });
  let generatedArtifacts: Awaited<ReturnType<typeof synthesizeRecipeWithAgent>> | undefined;

  const ensureGeneratedArtifacts = async () => {
    if (!generatedArtifacts) {
      generatedArtifacts = await synthesizeRecipeWithAgent({
        document,
        toolset,
        now: now()
      });
    }
    return generatedArtifacts;
  };

  const executePass = async <TResult>(
    id: PassSummary<TResult>['id'],
    label: string,
    runner: () => TResult | Promise<TResult>,
    notesFactory?: (result: TResult) => readonly string[]
  ): Promise<PassSummary<TResult>> => {
    const started = budgetGuard.beforePass(id);
    toolset.resetUsageLog();
    const result = await Promise.resolve(runner());
    const completed = now().getTime();
    const usage = mapUsageLog(toolset.getUsageLog());
    budgetGuard.afterPass(id, completed, usage.length);
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
    ruleSet ? 'Collect stored expectations' : 'Seed expected data via agent workflow',
    async () => {
      if (ruleSet) {
        return collectExpectedData({ ruleSet, toolset });
      }
      const artifacts = await ensureGeneratedArtifacts();
      return artifacts.expected;
    },
    (result) =>
      result.origin === 'agent'
        ? ['Initialized target data using iterative agent loop']
        : []
  );

  const synthesisSummary = await executePass<RecipeSynthesisSummary>(
    'pass-2-recipe-synthesis',
    'Synthesize candidate recipe',
    async () => {
      if (ruleSet) {
        return buildRecipeFromRuleSet({ ruleSet, now: now() });
      }
      const artifacts = await ensureGeneratedArtifacts();
      return artifacts.synthesis;
    },
    (result) =>
      result.origin === 'agent'
        ? [
            `Completed ${result.iterations.length} agent iterations`,
            'Selectors refined directly against fetched document'
          ]
        : ['Sourced field selectors from configurable rules']
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

  const passes: OrchestrationResult['passes'] = [
    expectedSummary,
    synthesisSummary,
    validationSummary
  ];

  return {
    startedAt: start,
    completedAt,
    budget,
    expected: expectedSummary.result,
    synthesis: synthesisSummary.result,
    validation: validationSummary.result,
    passes
  };
};

export {
  collectExpectedData,
  buildRecipeFromRuleSet,
  validateRecipeAgainstDocument
};
export type { DocumentRuleRepository } from './rule-repository.js';
export { createInMemoryRuleRepository } from './rule-repository.js';
