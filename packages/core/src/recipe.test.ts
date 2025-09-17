import { describe, expect, it } from 'vitest';

import { RecipeSchema, hasField } from './recipe.js';
import { getDefaultTolerance } from './tolerances.js';
import { applyTransform, getDefaultTransformOptions } from './transforms.js';

describe('RecipeSchema', () => {
  const now = new Date().toISOString();

  it('parses selector recipes with optional Playwright directives', () => {
    const recipe = RecipeSchema.parse({
      id: 'recipe-001',
      name: 'Fixture Product',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      target: {
        documentType: 'product',
        schema: {
          id: 'sku-1',
          title: 'Fixture Product',
          canonicalUrl: 'https://example.com/products/fixture',
          price: { amount: 19.99, currencyCode: 'USD' },
          images: ['https://example.com/assets/fixture.jpg']
        },
        fields: [
          {
            fieldId: 'title',
            selectorSteps: [{ strategy: 'css', value: 'h1.product-title' }],
            transforms: [{ name: 'text.collapse' }],
            tolerance: getDefaultTolerance('title'),
            validators: [{ type: 'required' }],
            metrics: { sampleCount: 3, passCount: 3, failCount: 0 }
          },
          {
            fieldId: 'images',
            selectorSteps: [
              {
                strategy: 'css',
                value: '.gallery img',
                attribute: 'src',
                playwright: { action: 'waitForSelector', selector: '.gallery img' }
              }
            ],
            transforms: [
              {
                name: 'url.resolve',
                options: { baseUrl: 'https://example.com/products/fixture' }
              }
            ],
            tolerance: getDefaultTolerance('images'),
            validators: [{ type: 'minLength', value: 1 }]
          }
        ]
      },
      lifecycle: {
        state: 'draft',
        since: now,
        history: [{ state: 'draft', at: now, actor: 'agent' }]
      },
      metrics: { totalRuns: 1, successfulRuns: 1 },
      provenance: [
        { fieldId: 'title', evidence: 'css:h1.product-title', confidence: 0.9 }
      ]
    });

    expect(recipe.target.fields).toHaveLength(2);
    expect(hasField(recipe, 'price')).toBe(false);
    expect(recipe.lifecycle.history[0]?.actor).toBe('agent');
  });

  it('rejects field definitions without selector steps', () => {
    const result = RecipeSchema.safeParse({
      name: 'Invalid Recipe',
      version: '0.0.1',
      createdAt: now,
      updatedAt: now,
      target: {
        documentType: 'product',
        schema: {
          title: 'Example',
          canonicalUrl: 'https://example.com/products/example',
          price: { amount: 10, currencyCode: 'USD' },
          images: ['https://example.com/image.jpg']
        },
        fields: []
      },
      lifecycle: { state: 'draft', since: now }
    });

    expect(result.success).toBe(false);
  });
});

describe('default helpers', () => {
  it('returns defensive copies for transform defaults', () => {
    const baseline = getDefaultTransformOptions('text.collapse');
    baseline.trim = false;

    const second = getDefaultTransformOptions('text.collapse');
    expect(second.trim).toBe(true);
  });

  it('returns defensive copies for tolerance defaults', () => {
    const tolerance = getDefaultTolerance('title');
    if (tolerance.kind !== 'text') {
      throw new Error('Unexpected tolerance kind');
    }

    tolerance.caseSensitive = true;
    const next = getDefaultTolerance('title');

    expect(next.kind).toBe('text');
    if (next.kind !== 'text') {
      throw new Error('Unexpected tolerance kind');
    }
    expect(next.caseSensitive).toBe(false);
  });
});

describe('transforms', () => {
  it('collapses whitespace deterministically', () => {
    const result = applyTransform('text.collapse', '  Sample\n Value   ');

    expect(result).toBe('Sample Value');
  });

  it('parses money strings into Money objects', () => {
    const result = applyTransform('money.parse', 'USD 1,234.50');

    expect(result).toEqual({
      amount: 1234.5,
      currencyCode: 'USD',
      precision: 2,
      raw: 'USD 1,234.50'
    });
  });

  it('resolves relative URLs against a base URL', () => {
    const result = applyTransform('url.resolve', '../assets/image.png', {
      baseUrl: 'https://example.com/products/item/'
    });

    expect(result).toBe('https://example.com/products/assets/image.png');
  });
});

