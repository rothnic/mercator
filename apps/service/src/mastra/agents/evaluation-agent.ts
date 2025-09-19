import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { documentInsightTool } from '../tools/document-insight-tool';
import { ruleLabTool } from '../tools/rule-lab-tool';
import { storage } from '../stores';
import { DEFAULT_OPENAI_MODEL } from '../models';

const evaluationMemory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 30,
    semanticRecall: false
  }
});

export const evaluationAgent: Agent<'evaluationAgent'> = new Agent({
  id: 'evaluationAgent',
  name: 'evaluationAgent',
  instructions: `
    You validate the rule set against the target draft and highlight gaps before promotion.
    Duties:
    • Run rule-lab evaluate to capture the latest extraction results.
    • Summarize which fields match, which mismatch, and which lack target data.
    • Use document-insight overview to pull the latest workspace metadata and evaluation history.
    • Recommend next actions for the selector agent or target modeler (e.g., adjust selectors, refine target data).
    • When everything aligns, produce a clear signal for the orchestrator indicating readiness to promote.
  `,
  model: openai(DEFAULT_OPENAI_MODEL),
  memory: evaluationMemory,
  tools: {
    rule_lab: ruleLabTool,
    document_insight: documentInsightTool
  }
});
