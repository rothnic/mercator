import { createFixtureToolset } from '@mercator/agent-tools';
import { getDefaultTolerance } from '@mercator/core';
import {
  PRODUCT_SIMPLE_FIXTURE_ID,
  getProductSimpleExpectedProduct,
  listProductSimpleHtmlChunks,
  loadProductSimpleFixture
} from '@mercator/fixtures';

import type { FieldRecipe } from '@mercator/core';
import type { DocumentRuleSet, FieldRuleDefinition } from '../rule-repository.js';

const VERSION = '0.1.0';

const createFieldRecipes = (): FieldRuleDefinition[] => {
  const product = getProductSimpleExpectedProduct();

  const definitions: FieldRuleDefinition[] = [];

  const base = <TField extends FieldRecipe>(recipe: TField, options: Omit<FieldRuleDefinition, 'recipe'>): FieldRuleDefinition => ({
    ...options,
    recipe
  });

  definitions.push(
    base(
      {
        fieldId: 'title',
        description: 'Primary product title from hero header.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '[data-test="product-title"]',
            note: 'Hero product title element'
          }
        ],
        transforms: [{ name: 'text.collapse' }],
        tolerance: getDefaultTolerance('title'),
        validators: [{ type: 'required' }],
        sample: product.title
      },
      { source: 'html', chunkId: 'hero', confidence: 0.9 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'price',
        description: 'Price container including currency code and amount.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '[data-test="product-price"]',
            note: 'Container with price currency symbol and numeric value'
          }
        ],
        transforms: [
          { name: 'text.collapse' },
          { name: 'money.parse', options: { currencyCode: product.price.currencyCode } }
        ],
        tolerance: getDefaultTolerance('price'),
        validators: [{ type: 'required' }],
        sample: product.price
      },
      { source: 'html', chunkId: 'hero', confidence: 0.9 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'images',
        description: 'Gallery images resolved to absolute URLs.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '[data-test="gallery-image"]',
            attribute: 'src',
            all: true,
            note: 'Collect gallery image sources'
          }
        ],
        transforms: [{ name: 'url.resolve' }],
        tolerance: getDefaultTolerance('images'),
        validators: [{ type: 'minLength', value: 1 }],
        sample: product.images
      },
      { source: 'html', chunkId: 'hero', confidence: 0.8 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'thumbnail',
        description: 'First gallery image used as thumbnail.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '[data-test="gallery-image"][data-position="1"]',
            attribute: 'src',
            note: 'Use the first gallery image as the thumbnail'
          }
        ],
        transforms: [{ name: 'url.resolve' }],
        tolerance: getDefaultTolerance('thumbnail'),
        validators: [{ type: 'required' }],
        sample: product.thumbnail
      },
      { source: 'html', chunkId: 'hero', confidence: 0.8 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'canonicalUrl',
        description: 'Canonical URL declared in the document head.',
        selectorSteps: [
          {
            strategy: 'css',
            value: 'link[rel="canonical"]',
            attribute: 'href',
            note: 'Canonical link relation in document head'
          }
        ],
        transforms: [{ name: 'url.resolve', options: { enforceHttps: true } }],
        tolerance: getDefaultTolerance('canonicalUrl'),
        validators: [{ type: 'required' }],
        sample: product.canonicalUrl
      },
      { source: 'html', confidence: 0.7 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'description',
        description: 'Meta description summarizing the product.',
        selectorSteps: [
          {
            strategy: 'css',
            value: 'meta[name="description"]',
            attribute: 'content',
            note: 'Meta description content attribute'
          }
        ],
        transforms: [{ name: 'text.collapse' }],
        tolerance: getDefaultTolerance('description'),
        validators: [{ type: 'minLength', value: 20 }],
        sample: product.description
      },
      { source: 'html', confidence: 0.6 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'aggregateRating',
        description: 'Aggregate rating widget displaying value and count.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '[data-test="aggregate-rating"]',
            note: 'Rating container includes data attributes and children'
          }
        ],
        transforms: [],
        tolerance: getDefaultTolerance('aggregateRating'),
        validators: [],
        sample: product.aggregateRating
      },
      { source: 'html', chunkId: 'hero', confidence: 0.7 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'breadcrumbs',
        description: 'Breadcrumb navigation list items.',
        selectorSteps: [
          {
            strategy: 'css',
            value: 'nav.breadcrumbs ol li',
            all: true,
            note: 'Breadcrumb ordered list items'
          }
        ],
        transforms: [],
        tolerance: getDefaultTolerance('breadcrumbs'),
        validators: [{ type: 'minLength', value: 1 }],
        sample: product.breadcrumbs
      },
      { source: 'html', chunkId: 'breadcrumbs', confidence: 0.7 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'brand',
        description: 'Brand eyebrow text in hero.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '.product__eyebrow',
            note: 'Hero eyebrow element shows brand name'
          }
        ],
        transforms: [{ name: 'text.collapse' }],
        tolerance: getDefaultTolerance('brand'),
        validators: [{ type: 'required' }],
        sample: product.brand
      },
      { source: 'html', chunkId: 'hero', confidence: 0.6 }
    )
  );

  definitions.push(
    base(
      {
        fieldId: 'sku',
        description: 'Footer SKU field containing identifier text.',
        selectorSteps: [
          {
            strategy: 'css',
            value: '[data-test="sku"]',
            note: 'Footer element with SKU label'
          }
        ],
        transforms: [{ name: 'text.collapse' }],
        tolerance: getDefaultTolerance('sku'),
        validators: [{ type: 'required' }],
        sample: product.sku
      },
      { source: 'html', confidence: 0.6 }
    )
  );

  return definitions;
};

const createEvidenceInstructions = () => {
  const product = getProductSimpleExpectedProduct();

  return [
    {
      kind: 'html-query' as const,
      fieldId: 'title',
      source: 'html' as const,
      selector: '[data-test="product-title"]',
      chunkId: 'hero',
      limit: 1,
      mode: 'first-text' as const,
      confidence: 0.9
    },
    {
      kind: 'html-query' as const,
      fieldId: 'price',
      source: 'html' as const,
      selector: '[data-test="product-price"]',
      chunkId: 'hero',
      limit: 1,
      mode: 'first-text' as const,
      confidence: 0.9
    },
    {
      kind: 'html-query' as const,
      fieldId: 'breadcrumbs',
      source: 'html' as const,
      selector: 'nav.breadcrumbs li',
      chunkId: 'breadcrumbs',
      limit: 4,
      mode: 'join-text' as const,
      joinWith: ' › ',
      confidence: 0.8
    },
    {
      kind: 'markdown-search' as const,
      fieldId: 'brand',
      source: 'markdown' as const,
      query: product.brand ?? '',
      maxSnippets: 1,
      confidence: 0.5
    },
    {
      kind: 'vision-ocr' as const,
      fieldId: 'title',
      source: 'vision' as const,
      lineIndex: 0,
      confidence: 0.6
    }
  ];
};

export const createProductSimpleRuleSet = (): DocumentRuleSet => {
  const product = getProductSimpleExpectedProduct();
  return {
    id: `${PRODUCT_SIMPLE_FIXTURE_ID}`,
    domain: 'demo.mercator.sh',
    pathPattern: '/products/:slug',
    documentType: 'product',
    version: VERSION,
    expectedProduct: product,
    ruleMetadata: {
      name: 'demo-product-simple',
      description: 'Rule configuration derived from the product simple fixture.',
      createdBy: 'fixtures@mercator',
      updatedBy: 'fixtures@mercator'
    },
    htmlChunks: listProductSimpleHtmlChunks(),
    evidenceInstructions: createEvidenceInstructions(),
    fieldRules: createFieldRecipes(),
    providedOcrTranscript: loadProductSimpleFixture().expected.ocrTranscript
  };
};

export const createProductSimpleDocument = () => {
  const fixture = loadProductSimpleFixture();
  return {
    domain: 'demo.mercator.sh',
    path: '/products/precision-pour-over-kettle',
    html: fixture.html
  };
};

export const createProductSimpleToolset = () => {
  return createFixtureToolset({ fixtureId: PRODUCT_SIMPLE_FIXTURE_ID });
};
