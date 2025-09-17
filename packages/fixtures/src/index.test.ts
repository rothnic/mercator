import { describe, expect, it } from 'vitest';

import { ProductSchema } from '@mercator/core';

import {
  getProductSimpleAssetPath,
  getProductSimpleExpectedProduct,
  listProductSimpleHtmlChunks,
  loadProductSimpleFixture
} from './index.js';

describe('product-simple fixture loader', () => {
  it('loads fixture assets and memoizes binary data', () => {
    const first = loadProductSimpleFixture();
    const second = loadProductSimpleFixture();

    expect(first.id).toBe('product-simple');
    expect(first.html).toContain('Precision Pour-Over Kettle');
    expect(first.markdown).toContain('Precision Pour-Over Kettle');
    expect(first.screenshot.equals(second.screenshot)).toBe(true);
    expect(first.screenshot).not.toBe(second.screenshot);
  });

  it('exposes strongly typed expected product data', () => {
    const fixture = loadProductSimpleFixture();
    expect(() => ProductSchema.parse(fixture.expected.product)).not.toThrow();
    expect(getProductSimpleExpectedProduct().title).toBe('Precision Pour-Over Kettle');
  });

  it('lists chunk metadata for html queries', () => {
    const chunks = listProductSimpleHtmlChunks();
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      'breadcrumbs',
      'hero',
      'details',
      'qa'
    ]);
  });

  it('returns file system paths for assets', () => {
    expect(getProductSimpleAssetPath('html')).toMatch(/product-simple\.html$/);
    expect(getProductSimpleAssetPath('markdown')).toMatch(/product-simple\.md$/);
    expect(getProductSimpleAssetPath('screenshot')).toMatch(/product-simple\.png\.base64$/);
  });
});
