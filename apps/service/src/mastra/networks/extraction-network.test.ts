import { describe, expect, it, vi } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { openai } from '@ai-sdk/openai';

const ruleLabMock = vi.hoisted(() => ({
  ruleLabTool: {
    id: 'rule-lab-mock',
    description: 'stubbed rule lab tool',
    inputSchema: undefined,
    outputSchema: undefined,
    execute: vi.fn()
  }
}));

vi.mock('../tools/rule-lab-tool', () => ruleLabMock);

import { MercatorAgentNetwork } from './extraction-network';
import { DEFAULT_OPENAI_MODEL } from '../models';

describe('MercatorAgentNetwork', () => {
  it('provides static instructions to the router and records specialist history', async () => {
    const specialist = new Agent({
      name: 'Sample Specialist',
      instructions: 'Return a short acknowledgement.',
      model: createMockModel({ mockText: 'Handled.' })
    });

    const network = new MercatorAgentNetwork({
      name: 'Unit Test Router',
      model: openai(DEFAULT_OPENAI_MODEL),
      instructions: 'Route requests to the specialists listed below.',
      agents: [specialist]
    });

    const routingInstructions = network.getRoutingAgent().instructions;
    expect(typeof routingInstructions).toBe('string');
    expect(routingInstructions).toContain('Sample_Specialist');

    const response = await network.getTools().transmit.execute({
      context: {
        actions: [
          { agent: 'Sample_Specialist', input: 'Collect product facts', includeHistory: true }
        ]
      }
    });

    expect(response).toContain('[Sample_Specialist]');

    const history = network.getAgentInteractionHistory();
    expect(history.Sample_Specialist).toHaveLength(1);
    expect(history.Sample_Specialist[0].input).toBe('Collect product facts');
    expect(history.Sample_Specialist[0].output).toBe('Handled.');
  });
});
