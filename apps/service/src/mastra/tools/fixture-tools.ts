import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { createFixtureToolset, type ToolUsageEntry } from '@mercator/agent-tools';
import { PRODUCT_SIMPLE_FIXTURE_ID } from '@mercator/fixtures';

const fixtureToolset = createFixtureToolset();

const visionOcrInputSchema = z
  .object({
    region: z
      .string()
      .min(1, 'Region must not be empty when provided')
      .describe('Optional viewport or selector hint narrowing the OCR scope.')
      .optional()
  })
  .describe('Parameters used to simulate OCR over the product-simple screenshot.');

const visionOcrOutputSchema = z.object({
  fixtureId: z.string(),
  lines: z.array(z.string()),
  fullText: z.string(),
  region: z.string().optional()
});

export const fixtureVisionOcrTool = createTool({
  id: 'fixture-vision-ocr',
  description:
    'Returns a deterministic OCR transcript sourced from the product-simple screenshot fixture.',
  inputSchema: visionOcrInputSchema,
  outputSchema: visionOcrOutputSchema,
  async execute({ context }) {
    const result = await fixtureToolset.vision.readOcr(context);
    return {
      ...result,
      lines: Array.from(result.lines)
    };
  }
});

const htmlChunkSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  selector: z.string(),
  description: z.string(),
  snippet: z.string(),
  nodeCount: z.number()
});

const htmlQueryInputSchema = z
  .object({
    selector: z
      .string()
      .min(1, 'Provide a CSS selector to match elements within the fixture document.'),
    attribute: z.string().optional(),
    chunkId: z.string().optional(),
    limit: z.number().int().positive().max(20).default(5)
  })
  .describe('Queries the rendered product-simple HTML fixture and returns deterministic matches.');

const htmlQueryMatchSchema = z.object({
  html: z.string(),
  text: z.string(),
  attributes: z.record(z.string()),
  attributeValue: z.string().optional(),
  path: z.string()
});

const htmlQueryOutputSchema = z.object({
  fixtureId: z.string(),
  totalMatches: z.number(),
  matches: z.array(htmlQueryMatchSchema),
  chunk: htmlChunkSummarySchema.optional()
});

export const fixtureHtmlQueryTool = createTool({
  id: 'fixture-html-query',
  description:
    'Performs deterministic CSS selector queries against the product-simple HTML fixture.',
  inputSchema: htmlQueryInputSchema,
  outputSchema: htmlQueryOutputSchema,
  async execute({ context }) {
    const result = await fixtureToolset.html.query(context);
    return {
      ...result,
      matches: result.matches.map((match) => ({
        ...match,
        attributes: { ...match.attributes }
      })),
      chunk: result.chunk ? { ...result.chunk } : undefined
    };
  }
});

const htmlListChunksOutputSchema = z.object({
  fixtureId: z.string(),
  chunks: z.array(htmlChunkSummarySchema)
});

export const fixtureHtmlListChunksTool = createTool({
  id: 'fixture-html-list-chunks',
  description:
    'Lists curated DOM chunk metadata used to scope HTML queries within the product-simple fixture.',
  inputSchema: z.object({}).describe('No parameters are required to enumerate fixture HTML chunks.'),
  outputSchema: htmlListChunksOutputSchema,
  async execute() {
    const chunks = await fixtureToolset.html.listChunks();
    return {
      fixtureId: PRODUCT_SIMPLE_FIXTURE_ID,
      chunks: chunks.map((chunk) => ({ ...chunk }))
    };
  }
});

const markdownSearchInputSchema = z
  .object({
    query: z.string().min(1, 'Provide a search phrase to match within the fixture markdown document.'),
    caseSensitive: z.boolean().optional(),
    maxSnippets: z.number().int().positive().max(10).optional()
  })
  .describe('Searches the deterministic product-simple markdown fixture for relevant excerpts.');

const markdownSearchMatchSchema = z.object({
  heading: z.string().nullable(),
  excerpt: z.string(),
  lineRange: z.tuple([z.number(), z.number()])
});

const markdownSearchOutputSchema = z.object({
  fixtureId: z.string(),
  totalMatches: z.number(),
  matches: z.array(markdownSearchMatchSchema)
});

export const fixtureMarkdownSearchTool = createTool({
  id: 'fixture-markdown-search',
  description: 'Returns deterministic excerpts from the product-simple markdown fixture.',
  inputSchema: markdownSearchInputSchema,
  outputSchema: markdownSearchOutputSchema,
  async execute({ context }) {
    const result = await fixtureToolset.markdown.search(context);
    return {
      ...result,
      matches: result.matches.map((match) => ({
        ...match,
        lineRange: [match.lineRange[0], match.lineRange[1]] as [number, number]
      }))
    };
  }
});

export const resetFixtureToolUsage = (): void => {
  fixtureToolset.resetUsageLog();
};

export const getFixtureToolUsage = (): readonly ToolUsageEntry[] => fixtureToolset.getUsageLog();
