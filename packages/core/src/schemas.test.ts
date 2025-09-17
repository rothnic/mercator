import { describe, expect, it } from 'vitest';

import {
  AggregateRatingSchema,
  BreadcrumbSchema,
  MoneySchema,
  ProductSchema
} from './schemas.js';

describe('MoneySchema', () => {
  it('normalizes currency codes and applies defaults', () => {
    const parsed = MoneySchema.parse({ amount: 19.99, currencyCode: 'usd' });

    expect(parsed).toEqual({ amount: 19.99, currencyCode: 'USD', precision: 2 });
  });

  it('rejects invalid currencies or negative amounts', () => {
    const invalidCurrency = MoneySchema.safeParse({ amount: 10, currencyCode: 'US' });
    const invalidAmount = MoneySchema.safeParse({ amount: -1, currencyCode: 'USD' });

    expect(invalidCurrency.success).toBe(false);
    expect(invalidAmount.success).toBe(false);
  });
});

describe('BreadcrumbSchema', () => {
  it('trims labels and accepts optional URLs', () => {
    const breadcrumb = BreadcrumbSchema.parse({
      label: '  Shoes  ',
      url: 'https://example.com/shoes'
    });

    expect(breadcrumb).toEqual({ label: 'Shoes', url: 'https://example.com/shoes' });
  });
});

describe('AggregateRatingSchema', () => {
  it('validates rating bounds relative to best and worst values', () => {
    const valid = AggregateRatingSchema.safeParse({
      ratingValue: 4.5,
      reviewCount: 120,
      bestRating: 5,
      worstRating: 1
    });
    const invalid = AggregateRatingSchema.safeParse({
      ratingValue: 6,
      bestRating: 5
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});

describe('ProductSchema', () => {
  it('parses a minimal MVP product payload', () => {
    const parsed = ProductSchema.parse({
      id: 'sku-123',
      title: '  Sample Product  ',
      canonicalUrl: 'https://example.com/products/sample',
      price: { amount: 42, currencyCode: 'usd' },
      images: ['https://example.com/assets/sample.jpg'],
      aggregateRating: {
        ratingValue: 4.7,
        reviewCount: 32,
        bestRating: 5,
        worstRating: 1
      },
      breadcrumbs: [
        { label: ' Home ', url: 'https://example.com' },
        { label: ' Shoes ', url: 'https://example.com/shoes' }
      ]
    });

    expect(parsed.title).toBe('Sample Product');
    expect(parsed.price.currencyCode).toBe('USD');
    expect(parsed.images).toEqual(['https://example.com/assets/sample.jpg']);
    expect(parsed.breadcrumbs?.[0].label).toBe('Home');
  });

  it('rejects products without images or with empty breadcrumbs', () => {
    const missingImages = ProductSchema.safeParse({
      title: 'Widget',
      canonicalUrl: 'https://example.com/widget',
      price: { amount: 10, currencyCode: 'usd' },
      images: []
    });

    const emptyBreadcrumbs = ProductSchema.safeParse({
      title: 'Widget',
      canonicalUrl: 'https://example.com/widget',
      price: { amount: 10, currencyCode: 'usd' },
      images: ['https://example.com/widget.jpg'],
      breadcrumbs: []
    });

    expect(missingImages.success).toBe(false);
    expect(emptyBreadcrumbs.success).toBe(false);
  });
});
