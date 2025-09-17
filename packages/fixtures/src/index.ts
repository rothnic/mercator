import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProductSchema, type Product } from '@mercator/core';

export const PRODUCT_SIMPLE_FIXTURE_ID = 'product-simple' as const;

export type ProductSimpleFixtureId = typeof PRODUCT_SIMPLE_FIXTURE_ID;

export interface HtmlChunkMetadata {
  readonly id: string;
  readonly label: string;
  readonly selector: string;
  readonly description: string;
}

export interface ProductSimpleFixture {
  readonly id: ProductSimpleFixtureId;
  readonly paths: {
    readonly html: string;
    readonly markdown: string;
    readonly screenshot: string;
  };
  readonly html: string;
  readonly markdown: string;
  readonly screenshot: Buffer;
  readonly expected: {
    readonly product: Product;
    readonly htmlChunks: readonly HtmlChunkMetadata[];
    readonly ocrTranscript: readonly string[];
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(__dirname, '../../../fixtures');

const HTML_CHUNKS: HtmlChunkMetadata[] = [
  {
    id: 'breadcrumbs',
    label: 'Breadcrumbs',
    selector: '[data-fixture-chunk="breadcrumbs"]',
    description: 'Ordered list navigation representing the global breadcrumb trail.'
  },
  {
    id: 'hero',
    label: 'Hero',
    selector: '[data-fixture-chunk="hero"]',
    description: 'Title, pricing, gallery, and primary call-to-action elements.'
  },
  {
    id: 'details',
    label: 'Details',
    selector: '[data-fixture-chunk="details"]',
    description: 'Long-form description copy, specifications definition list, and highlights.'
  },
  {
    id: 'qa',
    label: 'Questions & Answers',
    selector: '[data-fixture-chunk="qa"]',
    description: 'Deterministic FAQ entries answered inline.'
  }
];

const PRODUCT_SIMPLE_EXPECTED_PRODUCT: Product = ProductSchema.parse({
  title: 'Precision Pour-Over Kettle',
  canonicalUrl: 'https://demo.mercator.sh/products/precision-pour-over-kettle',
  description:
    'Precision Pour-Over Kettle with variable temperature control, balanced gooseneck spout, and 0.8 L capacity.',
  price: {
    amount: 149,
    currencyCode: 'USD',
    precision: 2,
    raw: '$149.00'
  },
  images: [
    'https://cdn.mercator.sh/assets/kettle/precision-pour-over-kettle.jpg',
    'https://cdn.mercator.sh/assets/kettle/precision-pour-over-kettle-angle.jpg'
  ],
  thumbnail: 'https://cdn.mercator.sh/assets/kettle/precision-pour-over-kettle.jpg',
  aggregateRating: {
    ratingValue: 4.6,
    reviewCount: 128,
    bestRating: 5,
    url: 'https://demo.mercator.sh/products/precision-pour-over-kettle#reviews'
  },
  breadcrumbs: [
    { label: 'Home', url: 'https://demo.mercator.sh/' },
    { label: 'Kitchen', url: 'https://demo.mercator.sh/kitchen' },
    { label: 'Coffee & Tea', url: 'https://demo.mercator.sh/kitchen/coffee-tea' },
    { label: 'Precision Pour-Over Kettle' }
  ],
  brand: 'Brimstone Labs',
  sku: 'BR-PPK-08'
});

const PRODUCT_SIMPLE_OCR_TRANSCRIPT = [
  'Precision Pour-Over Kettle',
  'Brimstone Labs',
  'Variable temperature gooseneck kettle',
  '$149.00',
  'Add to cart'
] as const;

let cachedFixture: ProductSimpleFixture | undefined;

const memoizeFixture = (): ProductSimpleFixture => {
  if (cachedFixture) {
    return {
      ...cachedFixture,
      screenshot: Buffer.from(cachedFixture.screenshot)
    };
  }

  const htmlPath = join(FIXTURE_ROOT, 'product-simple.html');
  const markdownPath = join(FIXTURE_ROOT, 'product-simple.md');
  const screenshotPath = join(FIXTURE_ROOT, 'product-simple.png.base64');

  const html = readFileSync(htmlPath, 'utf-8');
  const markdown = readFileSync(markdownPath, 'utf-8');
  const screenshotBase64 = readFileSync(screenshotPath, 'utf-8');
  const screenshot = Buffer.from(screenshotBase64, 'base64');

  cachedFixture = Object.freeze({
    id: PRODUCT_SIMPLE_FIXTURE_ID,
    paths: {
      html: htmlPath,
      markdown: markdownPath,
      screenshot: screenshotPath
    },
    html,
    markdown,
    screenshot,
    expected: {
      product: PRODUCT_SIMPLE_EXPECTED_PRODUCT,
      htmlChunks: HTML_CHUNKS,
      ocrTranscript: PRODUCT_SIMPLE_OCR_TRANSCRIPT
    }
  });

  return {
    ...cachedFixture,
    screenshot: Buffer.from(cachedFixture.screenshot)
  };
};

export const loadProductSimpleFixture = (): ProductSimpleFixture => memoizeFixture();

export const getProductSimpleAssetPath = (asset: 'html' | 'markdown' | 'screenshot'): string => {
  const fixture = memoizeFixture();
  return fixture.paths[asset];
};

export const getProductSimpleExpectedProduct = (): Product => {
  return ProductSchema.parse(PRODUCT_SIMPLE_EXPECTED_PRODUCT);
};

export const listProductSimpleHtmlChunks = (): readonly HtmlChunkMetadata[] => {
  return HTML_CHUNKS.map((chunk) => ({ ...chunk }));
};
