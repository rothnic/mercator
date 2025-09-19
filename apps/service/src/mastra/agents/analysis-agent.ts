import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { storage } from '../stores';

const analysisMemory: Memory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 20,
    semanticRecall: false
  }
});

export const analysisAgent: Agent<'analysisAgent'> = new Agent({
  id: 'analysisAgent',
  name: 'analysisAgent',
  instructions: `
    You are an analysis specialist focused on:
    - Processing complex data and extracting meaningful insights.
    - Creating detailed reports and narrative summaries.
    - Identifying correlations and causal relationships.
    - Providing actionable recommendations based on evidence.

    Your analysis should be thorough, evidence-based, and oriented toward decision making. Store analysis results in working memory for cross-referencing.
  `,
  model: openai('gpt-4o-mini'),
  memory: analysisMemory
});
