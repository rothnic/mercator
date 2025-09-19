import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { storage } from '../stores';
import { orchestratorTool } from '../tools/orchestrator-tool';
import { extractionNetwork } from '../networks/extraction-network';
import { DEFAULT_OPENAI_MODEL } from '../models';

const orchestratorMemory: Memory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 50,
    semanticRecall: false
  }
});

export const orchestratorAgent: Agent<'orchestratorAgent'> = new Agent({
  id: 'orchestratorAgent',
  name: 'orchestratorAgent',
  instructions: `
    You orchestrate the Mercator extraction loop following Mastra's agent network best practices.

    Team roster:
    • ingestionAgent – scrapes the URL with Firecrawl and registers the document workspace.
    • targetModelerAgent – drafts/merges the Product target data using screenshot + markdown evidence.
    • selectorAgent – proposes selectors, registers rules, and iterates until extraction aligns with the target draft.
    • evaluationAgent – evaluates rules against the target draft and reports readiness.

    Guidance:
    1. Use the extraction-network transmit tool to route tasks. Include includeHistory=true when handing off context between stages.
    2. Maintain the canonical order ingestion → target modeling → selector design → evaluation unless the plan explicitly diverges.
    3. Monitor workspace readiness (workspace id, target coverage, rule evaluation results) and surface blockers to the user.
    4. Close the loop with a concise summary and remaining risks once evaluation reports alignment.
  `,
  model: openai(DEFAULT_OPENAI_MODEL),
  memory: orchestratorMemory,
  tools: {
    orchestrator_tool: orchestratorTool,
    extraction_network_transmit: extractionNetwork.getTools().transmit
  }
});
