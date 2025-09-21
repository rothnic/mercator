import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { documentInsightTool } from '../tools/document-insight-tool';
import { targetDraftTool } from '../tools/target-draft-tool';
import { storage } from '../stores';
import { DEFAULT_OPENAI_MODEL } from '../models';

const targetModelerMemory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 40,
    semanticRecall: false
  }
});

const TARGET_MODELER_TRACE_METADATA = Object.freeze({
  agentId: 'targetModelerAgent',
  role: 'target-modeler'
});

export const targetModelerAgent: Agent<'targetModelerAgent'> = new Agent({
  id: 'targetModelerAgent',
  name: 'targetModelerAgent',
  instructions: `
    You transform raw artifacts (screenshots, markdown, HTML metadata) into a structured product target draft.
    Responsibilities:
    • Start every engagement by calling document_insight.visionOcr to read up to 10 lines of the screenshot transcript. Summarize what you learn and extract provisional product facts (title, price, brand, hero actions).
    • Turn those provisional facts into 3-5 focused keywords and call document_insight.htmlSearch to retrieve small HTML snippets. Do not request broad selectors such as body or #root.
    • When you have a promising snippet, follow up with document_insight.htmlQuery to capture the exact element + attribute needed for structured data.
    • Iterate: vision → keywords → htmlSearch/htmlQuery. Only fetch more snippets when the current evidence is insufficient.
    • Populate the target product draft with the Product schema (id, title, canonicalUrl, price, images, etc.).
    • Merge updates incrementally—do not wipe existing values unless they are incorrect. After each evidence-gathering loop, call target_draft.merge with the fields you confirmed.
    • Call the target-draft tool with either "merge" for partial updates or "replace" when emitting a complete object.
    • Summarize remaining unknown fields so the selector agent knows what to look for.
  `,
  model: openai(DEFAULT_OPENAI_MODEL),
  memory: targetModelerMemory,
  defaultGenerateOptions: {
    tracingOptions: {
      metadata: TARGET_MODELER_TRACE_METADATA
    }
  },
  defaultStreamOptions: {
    tracingOptions: {
      metadata: TARGET_MODELER_TRACE_METADATA
    }
  },
  tools: {
    document_insight: documentInsightTool,
    target_draft: targetDraftTool
  }
});
