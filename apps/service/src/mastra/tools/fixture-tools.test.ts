import { describe, expect, beforeEach, it } from 'vitest';

import { PRODUCT_SIMPLE_FIXTURE_ID } from '@mercator/fixtures';
import { RuntimeContext } from '@mastra/core/runtime-context';

import {
  fixtureHtmlListChunksTool,
  fixtureHtmlQueryTool,
  fixtureMarkdownSearchTool,
  fixtureVisionOcrTool,
  getFixtureToolUsage,
  resetFixtureToolUsage
} from './fixture-tools';


describe('fixture tool wrappers', () => {
  beforeEach(() => {
    resetFixtureToolUsage();
  });

  it('returns deterministic OCR transcripts', async () => {
    const visionContext: Parameters<NonNullable<typeof fixtureVisionOcrTool.execute>>[0] = {
      context: { region: 'hero' },
      runtimeContext: new RuntimeContext()
    };

    const result = await fixtureVisionOcrTool.execute(visionContext);

    expect(result.fixtureId).toBe(PRODUCT_SIMPLE_FIXTURE_ID);
    expect(result.region).toBe('hero');
    expect(result.lines).toContain('Precision Pour-Over Kettle');
    expect(result.fullText).toContain('Add to cart');

    const usage = getFixtureToolUsage();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ tool: 'vision.ocr', input: { region: 'hero' } });
  });

  it('lists curated HTML chunks', async () => {
    const listContext: Parameters<NonNullable<typeof fixtureHtmlListChunksTool.execute>>[0] = {
      context: {},
      runtimeContext: new RuntimeContext()
    };

    const result = await fixtureHtmlListChunksTool.execute(listContext);

    expect(result.fixtureId).toBe(PRODUCT_SIMPLE_FIXTURE_ID);
    expect(result.chunks).toHaveLength(4);
    expect(result.chunks[0]).toHaveProperty('snippet');
    expect(result.chunks[0]).toHaveProperty('nodeCount');

    const usage = getFixtureToolUsage();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ tool: 'html.listChunks' });
  });

  it('queries HTML chunks with CSS selectors', async () => {
    const queryContext: Parameters<NonNullable<typeof fixtureHtmlQueryTool.execute>>[0] = {
      context: {
        selector: '[data-test="product-title"]',
        chunkId: 'hero',
        limit: 1
      },
      runtimeContext: new RuntimeContext()
    };

    const result = await fixtureHtmlQueryTool.execute(queryContext);

    expect(result.fixtureId).toBe(PRODUCT_SIMPLE_FIXTURE_ID);
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.matches[0]?.text).toBe('Precision Pour-Over Kettle');
    expect(result.matches[0]?.attributes).toHaveProperty('data-test', 'product-title');

    const usage = getFixtureToolUsage();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ tool: 'html.query' });
  });

  it('searches the markdown fixture', async () => {
    const markdownContext: Parameters<NonNullable<typeof fixtureMarkdownSearchTool.execute>>[0] = {
      context: { query: 'temperature' },
      runtimeContext: new RuntimeContext()
    };

    const result = await fixtureMarkdownSearchTool.execute(markdownContext);

    expect(result.fixtureId).toBe(PRODUCT_SIMPLE_FIXTURE_ID);
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.matches[0]?.excerpt.toLowerCase()).toContain('temperature');

    const usage = getFixtureToolUsage();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ tool: 'markdown.search' });
  });
});
