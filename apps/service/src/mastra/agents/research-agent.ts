import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { storage } from '../stores';
import { dataTool } from '../tools/data-tool';
import {
  fixtureHtmlListChunksTool,
  fixtureHtmlQueryTool,
  fixtureMarkdownSearchTool,
  fixtureVisionOcrTool
} from '../tools/fixture-tools';

const researchMemory: Memory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 20,
    semanticRecall: { topK: 5, messageRange: 5 }
  }
});

export const researchAgent: Agent<'researchAgent'> = new Agent({
  id: 'researchAgent',
  name: 'researchAgent',
  instructions: `
    You are a research specialist agent focused on:
    - Gathering comprehensive information from available data sources.
    - Performing thorough analysis of collected data.
    - Identifying patterns, trends, and key insights.
    - Presenting findings in structured formats with citations when possible.

    Always cite your sources, provide confidence levels for your findings, and store important insights in working memory for future reference.
  `,
  model: openai('gpt-4o-mini'),
  memory: researchMemory,
  tools: {
    data_tool: dataTool,
    fixture_vision_ocr: fixtureVisionOcrTool,
    fixture_html_query: fixtureHtmlQueryTool,
    fixture_html_chunks: fixtureHtmlListChunksTool,
    fixture_markdown_search: fixtureMarkdownSearchTool
  }
});
