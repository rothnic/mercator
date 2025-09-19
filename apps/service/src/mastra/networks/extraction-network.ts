import { openai } from '@ai-sdk/openai';
import { AgentNetwork } from '@mastra/core/network';

import { ingestionAgent } from '../agents/ingestion-agent';
import { targetModelerAgent } from '../agents/target-modeler-agent';
import { selectorAgent } from '../agents/selector-agent';
import { evaluationAgent } from '../agents/evaluation-agent';
import { DEFAULT_OPENAI_MODEL } from '../models';

export const extractionNetwork = new AgentNetwork({
  name: 'extraction-network',
  model: openai(DEFAULT_OPENAI_MODEL),
  instructions: `
    Coordinate Mercator's document-ingestion workflow exactly as outlined in the Mastra AgentNetwork documentation.
    The expected sequence is:
    1. ingestionAgent → scrape the URL via Firecrawl and register the workspace.
    2. targetModelerAgent → craft/merge the Product target draft from screenshot + markdown evidence.
    3. selectorAgent → propose selectors, register rules, and iterate with evaluations until fields align.
    4. evaluationAgent → confirm matches, highlight gaps, and signal readiness.

    Always preserve context between steps by setting includeHistory=true when handing off to downstream agents.
    Produce concise routing rationales so the primary orchestrator can display clear progress to the user.
  `,
  agents: [ingestionAgent, targetModelerAgent, selectorAgent, evaluationAgent]
});
