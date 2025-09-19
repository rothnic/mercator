import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { scrapeUrlTool } from '../tools/scrape-url-tool';
import { recipeIntelTool } from '../tools/recipe-intel-tool';
import { documentInsightTool } from '../tools/document-insight-tool';
import { storage } from '../stores';
import { DEFAULT_OPENAI_MODEL } from '../models';

const ingestionMemory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 40,
    semanticRecall: false
  }
});

export const ingestionAgent: Agent<'ingestionAgent'> = new Agent({
  id: 'ingestionAgent',
  name: 'ingestionAgent',
  instructions: `
    You are the ingestion specialist for the Mercator extraction team.
    Your responsibilities are:
    • Accept a URL from the orchestrator and fetch it using the Firecrawl-powered scrape tool.
    • Register or refresh the document workspace so downstream agents can query HTML, markdown, and screenshots.
    • Surface any stored recipes for the domain/path so the team understands prior coverage.
    • Provide a concise status summary (workspace id, whether the scrape was refreshed, and available artifacts).

    Follow the Mastra team orchestration guidance:
    1. Always call the scrape tool before attempting to inspect the document workspace.
    2. After scraping, call the recipe intel tool to report existing draft/stable recipes.
    3. Use the document insight overview action to confirm the workspace metadata before responding.
    4. Respond with actionable notes for the rest of the team (e.g., screenshot availability, known rules).
  `,
  model: openai(DEFAULT_OPENAI_MODEL),
  memory: ingestionMemory,
  tools: {
    scrape_url: scrapeUrlTool,
    recipe_intel: recipeIntelTool,
    document_insight: documentInsightTool
  }
});
