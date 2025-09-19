import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { documentInsightTool } from '../tools/document-insight-tool';
import { ruleLabTool } from '../tools/rule-lab-tool';
import { targetDraftTool } from '../tools/target-draft-tool';
import { storage } from '../stores';
import { DEFAULT_OPENAI_MODEL } from '../models';

const selectorMemory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 60,
    semanticRecall: false
  }
});

export const selectorAgent: Agent<'selectorAgent'> = new Agent({
  id: 'selectorAgent',
  name: 'selectorAgent',
  instructions: `
    You design CSS selector rules that extract the target product data.
    Workflow:
    1. Read the current target draft using the target-draft tool (action "get").
    2. Probe the HTML with document-insight htmlQuery requests to confirm candidate selectors and attribute patterns.
    3. Register or update field rules with the rule-lab tool (action "set"). Provide notes for tricky selectors.
    4. After changing rules, call rule-lab evaluate to compare extracted values against the target draft.
    5. Report mismatches, missing selectors, and next actions for the evaluation agent.

    Constraints:
    • Prefer stable selectors (semantic attributes, data-test ids, structured lists) over brittle nth-child chains.
    • Keep field coverage balanced—ensure at least title, canonicalUrl, price, and one image are addressed before moving on.
    • Do not remove rules unless they are clearly incorrect; instead update them in place.
  `,
  model: openai(DEFAULT_OPENAI_MODEL),
  memory: selectorMemory,
  tools: {
    document_insight: documentInsightTool,
    rule_lab: ruleLabTool,
    target_draft: targetDraftTool
  }
});
