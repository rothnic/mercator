import { beforeEach, describe, expect, it } from 'vitest';

import { createFixtureToolset } from './index.js';

describe('fixture toolset', () => {
  const toolset = createFixtureToolset();

  beforeEach(() => {
    toolset.resetUsageLog();
  });

  it('returns deterministic OCR transcripts', async () => {
    const result = await toolset.vision.readOcr({ region: 'hero' });
    expect(result.fixtureId).toBe('product-simple');
    expect(result.lines[0]).toBe('Precision Pour-Over Kettle');
    expect(result.fullText).toContain('Add to cart');
    expect(toolset.getUsageLog()[0]?.tool).toBe('vision.ocr');
  });

  it('lists HTML chunks and resolves selectors within a chunk', async () => {
    const chunks = await toolset.html.listChunks();
    expect(chunks.map((chunk) => chunk.id)).toEqual(['breadcrumbs', 'hero', 'details', 'qa']);

    const titleResult = await toolset.html.query({ selector: '[data-test="product-title"]' });
    expect(titleResult.totalMatches).toBe(1);
    expect(titleResult.matches[0]?.text).toBe('Precision Pour-Over Kettle');

    const breadcrumbLinks = await toolset.html.query({ selector: 'a', chunkId: 'breadcrumbs', limit: 2 });
    expect(breadcrumbLinks.matches.length).toBe(2);
    expect(breadcrumbLinks.matches[0]?.attributes.href).toBe('https://demo.mercator.sh/');
  });

  it('searches markdown sections for deterministic snippets', async () => {
    const result = await toolset.markdown.search({ query: 'warranty' });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.matches[0]?.excerpt).toContain('two-year limited warranty');
  });

  it('records tool usage entries in order', async () => {
    await toolset.html.listChunks();
    await toolset.html.query({ selector: '[data-test="price-amount"]' });
    await toolset.markdown.search({ query: 'stainless steel' });

    const usage = toolset.getUsageLog();
    expect(usage.map((entry) => entry.tool)).toEqual([
      'html.listChunks',
      'html.query',
      'markdown.search'
    ]);
    expect(usage.every((entry) => entry.timestamp)).toBe(true);
  });
});
