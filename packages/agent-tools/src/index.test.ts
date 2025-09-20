import { beforeEach, describe, expect, it } from 'vitest';

import { createDocumentToolset, createFixtureToolset } from './index.js';

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

describe('createDocumentToolset', () => {
  it('falls back to the full document when chunk metadata is missing', async () => {
    const html = `
      <html>
        <body>
          <section id="hero">
            <h1 data-test="title">Dynamic Product</h1>
          </section>
        </body>
      </html>
    `;

    const toolset = createDocumentToolset({ documentId: 'dynamic', html });
    const result = await toolset.html.query({ selector: '[data-test="title"]', chunkId: 'hero' });

    expect(result.totalMatches).toBe(1);
    expect(result.matches[0]?.text).toBe('Dynamic Product');
  });

  it('returns provided OCR transcripts and empty markdown results when no markdown is supplied', async () => {
    const html = '<html><body><p>Example</p></body></html>';
    const transcript = ['line one', 'line two'];
    const toolset = createDocumentToolset({ documentId: 'doc', html, ocrTranscript: transcript });

    const ocr = await toolset.vision.readOcr();
    expect(ocr.lines).toEqual(transcript);
    expect(ocr.fullText).toBe('line one\nline two');

    const markdown = await toolset.markdown.search({ query: 'anything' });
    expect(markdown.matches).toEqual([]);
    expect(markdown.totalMatches).toBe(0);
  });
});
