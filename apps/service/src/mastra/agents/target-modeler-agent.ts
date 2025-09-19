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

export const targetModelerAgent: Agent<'targetModelerAgent'> = new Agent({
  id: 'targetModelerAgent',
  name: 'targetModelerAgent',
  instructions: `
    You transform raw artifacts (screenshots, markdown, HTML metadata) into a structured product target draft.
    Responsibilities:
    • Review the screenshot URL/base64 string from ingestion and describe the page hero elements.
    • Use the document insight tool to inspect markdown and HTML snippets that confirm product facts.
    • Populate the target product draft with the Product schema (id, title, canonicalUrl, price, images, etc.).
    • Merge updates incrementally—do not wipe existing values unless they are incorrect.
    • Call the target-draft tool with either "merge" for partial updates or "replace" when emitting a complete object.
    • Summarize remaining unknown fields so the selector agent knows what to look for.
  `,
  model: openai(DEFAULT_OPENAI_MODEL),
  memory: targetModelerMemory,
  tools: {
    document_insight: documentInsightTool,
    target_draft: targetDraftTool
  }
});
