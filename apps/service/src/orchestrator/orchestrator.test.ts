import { describe, expect, it } from 'vitest';

import { runAgentOrchestrationSlice } from './index.js';
import { createProductSimpleDocument, createProductSimpleRuleSet, createProductSimpleToolset } from './__fixtures__/product-simple.js';
import { createInMemoryRuleRepository } from './rule-repository.js';

describe('runAgentOrchestrationSlice', () => {
  it('runs the three-pass orchestration and returns a validated recipe', async () => {
    const timestamps = [
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-01-01T00:00:01Z'),
      new Date('2024-01-01T00:00:02Z'),
      new Date('2024-01-01T00:00:03Z'),
      new Date('2024-01-01T00:00:04Z')
    ];
    let index = 0;

    const toolset = createProductSimpleToolset();
    const document = createProductSimpleDocument();
    const ruleRepository = createInMemoryRuleRepository([createProductSimpleRuleSet()]);

    const result = await runAgentOrchestrationSlice({
      document,
      toolset,
      ruleRepository,
      now: () => timestamps[Math.min(index++, timestamps.length - 1)]
    });

    expect(result.passes).toHaveLength(3);
    const [expectedPass, synthesisPass, validationPass] = result.passes;
    expect(expectedPass.id).toBe('pass-1-expected-data');
    expect(expectedPass.toolUsage.length).toBeGreaterThan(0);
    expect(synthesisPass.result.recipe.target.fields.length).toBeGreaterThan(5);
    expect(validationPass.result.status).toBe('pass');
    expect(result.validation.status).toBe('pass');
    expect(result.validation.confidence).toBeGreaterThan(0.9);
    expect(result.expected.supportingEvidence.length).toBeGreaterThan(0);
  });

  it('enforces minimum pass budget', async () => {
    const toolset = createProductSimpleToolset();
    const document = createProductSimpleDocument();
    const ruleRepository = createInMemoryRuleRepository([createProductSimpleRuleSet()]);

    await expect(
      runAgentOrchestrationSlice({
        document,
        toolset,
        ruleRepository,
        budget: { maxPasses: 2 }
      })
    ).rejects.toThrow(/requires at least three passes/i);
  });
});
