import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  mergeTargetDraft,
  registerDocumentWorkspace,
  setRule
} from './document-workspace.js';

const SAMPLE_HTML = `
<html>
  <body>
    <h1 class="product-title">Mercator Widget</h1>
    <a class="product-link" href="https://example.com/widget">View product</a>
    <span class="price" data-amount="19.99">$19.99</span>
    <img class="gallery" src="https://example.com/widget-1.jpg" />
  </body>
</html>
`;

const SAMPLE_MARKDOWN = `# Mercator Widget\n\nPrice: $19.99`; 

describe('document-workspace', () => {
  it('registers a workspace and records metadata', () => {
    const snapshot = registerDocumentWorkspace({
      url: 'https://example.com/widget',
      domain: 'example.com',
      path: '/widget',
      html: SAMPLE_HTML,
      markdown: SAMPLE_MARKDOWN,
      screenshotUrl: 'https://example.com/widget.png',
      screenshotBase64: 'ZmFrZS1pbWFnZS1ieXRlcw=='
    });

    expect(snapshot.url).toBe('https://example.com/widget');
    expect(snapshot.domain).toBe('example.com');
    expect(snapshot.path).toBe('/widget');
    expect(snapshot.htmlLength).toBeGreaterThan(0);
    expect(snapshot.markdownLength).toBeGreaterThan(0);
    expect(snapshot.ruleCount).toBe(0);
    expect(snapshot.screenshotUrl).toBe('https://example.com/widget.png');
    expect(snapshot.screenshotBase64).toBe('ZmFrZS1pbWFnZS1ieXRlcw==');
  });

  it('merges target draft data without overwriting unrelated fields', () => {
    const snapshot = registerDocumentWorkspace({
      url: 'https://example.com/merge',
      domain: 'example.com',
      path: '/merge',
      html: SAMPLE_HTML,
      markdown: SAMPLE_MARKDOWN
    });

    const first = mergeTargetDraft(snapshot.id, {
      title: 'Mercator Widget',
      canonicalUrl: 'https://example.com/merge',
      price: {
        amount: 19.99,
        currencyCode: 'USD',
        precision: 2,
        raw: '$19.99'
      }
    });

    expect(first.targetDraft?.title).toBe('Mercator Widget');
    expect(first.targetDraft?.price?.amount).toBe(19.99);

    const second = mergeTargetDraft(snapshot.id, {
      images: ['https://example.com/widget-1.jpg', 'https://example.com/widget-2.jpg']
    });

    expect(second.targetDraft?.title).toBe('Mercator Widget');
    expect(second.targetDraft?.images).toEqual([
      'https://example.com/widget-1.jpg',
      'https://example.com/widget-2.jpg'
    ]);
    expect(second.targetDraft?.price?.amount).toBe(19.99);
  });

  it('evaluates selectors against the target draft', async () => {
    const snapshot = registerDocumentWorkspace({
      url: 'https://example.com/evaluate',
      domain: 'example.com',
      path: '/evaluate',
      html: SAMPLE_HTML,
      markdown: SAMPLE_MARKDOWN
    });

    mergeTargetDraft(snapshot.id, {
      title: 'Mercator Widget'
    });

    setRule(snapshot.id, {
      fieldId: 'title',
      selector: '.product-title',
      strategy: 'css',
      all: false
    });

    const [result] = await evaluateRules(snapshot.id, ['title']);
    expect(result.status).toBe('match');
    expect(result.extracted).toBe('Mercator Widget');
  });
});
