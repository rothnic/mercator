import { load } from 'cheerio';

import {
  ProductSchema,
  RecipeSchema,
  getDefaultTolerance,
  type FieldRecipe,
  type Product,
  type RecipeFieldId
} from '@mercator/core';
import type { FixtureToolset } from '@mercator/agent-tools';
import type {
  AgentIterationLogEntry,
  ExpectedDataSummary,
  RecipeSynthesisSummary
} from '@mercator/core/agents';

import type { DocumentSnapshot } from './index.js';

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const toAbsoluteUrl = (value: string | undefined, base: URL): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
};

const sanitizeSku = (value: string): string => value.replace(/^sku:\s*/i, '').trim();

interface EvidenceEntry {
  readonly snippet: string;
  readonly confidence: number;
  readonly chunkId?: string;
}

const inferPrecision = (amountText: string): number => {
  const [, fractional] = amountText.split('.');
  return fractional ? fractional.length : 0;
};

const createFieldRecipe = (
  field: RecipeFieldId,
  selector: string,
  options: {
    readonly note?: string;
    readonly attribute?: string;
    readonly ordinal?: number;
    readonly all?: boolean;
    readonly transforms?: FieldRecipe['transforms'];
    readonly validators?: FieldRecipe['validators'];
    readonly sample: unknown;
  }
): FieldRecipe => {
  return {
    fieldId: field,
    description: `Selector synthesized by agent workflow for ${field}.`,
    selectorSteps: [
      {
        strategy: 'css',
        value: selector,
        note: options.note,
        attribute: options.attribute,
        ordinal: options.ordinal,
        all: options.all ?? false
      }
    ],
    transforms: options.transforms ?? [],
    tolerance: getDefaultTolerance(field),
    validators: options.validators ?? [],
    metrics: { sampleCount: 0, passCount: 0, failCount: 0 },
    sample: options.sample
  } satisfies FieldRecipe;
};

const cloneTarget = (target: Partial<Product>): Partial<Product> => ({ ...target });

export interface AgentSynthesisArtifacts {
  readonly expected: ExpectedDataSummary;
  readonly synthesis: RecipeSynthesisSummary;
}

export const synthesizeRecipeWithAgent = async (options: {
  readonly document: DocumentSnapshot;
  readonly toolset: FixtureToolset;
  readonly now: Date;
}): Promise<AgentSynthesisArtifacts> => {
  const { document, toolset, now } = options;
  const origin = `https://${document.domain}`;
  const baseUrl = new URL(document.path || '/', origin);
  const ocrResult = await toolset.vision.readOcr();
  await toolset.html.listChunks();

  const evidenceMap = new Map<RecipeFieldId, EvidenceEntry>();
  const fieldRecipes = new Map<RecipeFieldId, FieldRecipe>();
  let partialTarget: Partial<Product> = {};
  const iterations: AgentIterationLogEntry[] = [];

  const addEvidence = (fieldId: RecipeFieldId, snippet: string | undefined, confidence: number, chunkId?: string) => {
    const normalized = snippet ? collapseWhitespace(snippet) : '';
    if (!normalized) {
      return;
    }
    evidenceMap.set(fieldId, { snippet: normalized.slice(0, 240), confidence, chunkId });
  };

  const recordIteration = (
    iteration: number,
    thought: string,
    updatedFields: readonly FieldRecipe[],
    targetUpdates: Partial<Product>,
    scraped: Readonly<Record<string, unknown>>
  ) => {
    updatedFields.forEach((field) => fieldRecipes.set(field.fieldId, field));
    partialTarget = { ...partialTarget, ...targetUpdates };
    iterations.push({
      iteration,
      agentThought: thought,
      updatedTargetData: cloneTarget(partialTarget),
      updatedSelectors: updatedFields.map((field) => ({
        fieldId: field.fieldId,
        selector: field.selectorSteps[0]?.value ?? '',
        notes: field.selectorSteps[0]?.note
      })),
      scrapedSamples: { ...scraped }
    });
  };

  // Iteration 1: seed title and brand using OCR plus hero queries
  const titleQuery = await toolset.html.query({ selector: '[data-test="product-title"]', limit: 1 });
  const brandQuery = await toolset.html.query({ selector: '.product__eyebrow', limit: 1 });
  const titleText = collapseWhitespace(titleQuery.matches[0]?.text ?? ocrResult.lines[0] ?? '');
  const brandText = collapseWhitespace(brandQuery.matches[0]?.text ?? ocrResult.lines[1] ?? '');

  if (!titleText) {
    throw new Error('Agent workflow failed to locate a product title.');
  }

  const titleField = createFieldRecipe('title', '[data-test="product-title"]', {
    note: 'Hero product title element discovered via OCR seeding.',
    transforms: [{ name: 'text.collapse' }],
    validators: [{ type: 'required' }],
    sample: titleText
  });
  const brandField = createFieldRecipe('brand', '.product__eyebrow', {
    note: 'Eyebrow label indicating product brand.',
    transforms: [{ name: 'text.collapse' }],
    sample: brandText
  });

  addEvidence('title', titleQuery.matches[0]?.text ?? ocrResult.lines[0], 0.85, 'hero');
  addEvidence('brand', brandQuery.matches[0]?.text ?? ocrResult.lines[1], 0.7, 'hero');

  recordIteration(1, 'Seeded title and brand from OCR transcript and confirmed selectors within the hero chunk.', [titleField, brandField], {
    title: titleText,
    brand: brandText
  }, {
    title: titleText,
    brand: brandText
  });

  // Iteration 2: establish canonical URL, description, and normalized pricing
  const priceContainer = await toolset.html.query({ selector: '[data-test="product-price"]', limit: 1 });
  const amountResult = await toolset.html.query({ selector: '[data-test="price-amount"]', limit: 1 });
  const currencyCodeResult = await toolset.html.query({ selector: '[data-test="price-currency"]', limit: 1 });
  const currencySymbolResult = await toolset.html.query({ selector: '.price__currency', limit: 1 });

  const amountText = collapseWhitespace(amountResult.matches[0]?.text ?? '0');
  const amount = Number.parseFloat(amountText);
  const currencyCode = collapseWhitespace(currencyCodeResult.matches[0]?.text ?? 'USD').toUpperCase();
  const currencySymbol = collapseWhitespace(currencySymbolResult.matches[0]?.text ?? '$');
  const priceRaw = `${currencySymbol}${amountText}`;
  const precision = Number.isFinite(amount) ? inferPrecision(amountText) : 2;

  const canonicalResult = await toolset.html.query({
    selector: 'link[rel="canonical"]',
    attribute: 'href',
    limit: 1
  });
  const canonicalUrl = canonicalResult.matches[0]?.attributeValue
    ? toAbsoluteUrl(canonicalResult.matches[0]?.attributeValue, baseUrl) ?? baseUrl.toString()
    : baseUrl.toString();

  const descriptionResult = await toolset.html.query({
    selector: 'meta[name="description"]',
    attribute: 'content',
    limit: 1
  });
  const description = collapseWhitespace(descriptionResult.matches[0]?.attributeValue ?? '');

  const priceField = createFieldRecipe('price', '[data-test="product-price"]', {
    note: 'Price container including currency symbol and numeric value.',
    transforms: [
      { name: 'text.collapse' },
      { name: 'money.parse', options: { currencyCode } }
    ],
    validators: [{ type: 'required' }],
    sample: {
      amount: Number.isFinite(amount) ? amount : 0,
      currencyCode,
      precision,
      raw: priceRaw
    }
  });

  const canonicalField = createFieldRecipe('canonicalUrl', 'link[rel="canonical"]', {
    note: 'Canonical URL declared in document head.',
    attribute: 'href',
    transforms: [{ name: 'url.resolve', options: { enforceHttps: true } }],
    validators: [{ type: 'required' }],
    sample: canonicalUrl
  });

  const descriptionField = createFieldRecipe('description', 'meta[name="description"]', {
    note: 'Meta description content attribute.',
    attribute: 'content',
    transforms: [{ name: 'text.collapse' }],
    validators: [{ type: 'minLength', value: 20 }],
    sample: description
  });

  addEvidence('price', priceContainer.matches[0]?.text, 0.9, 'hero');
  addEvidence('canonicalUrl', canonicalUrl, 0.75);
  addEvidence('description', descriptionResult.matches[0]?.attributeValue, 0.7);

  recordIteration(
    2,
    'Normalized canonical URL, meta description, and pricing selectors after inspecting hero markup.',
    [priceField, canonicalField, descriptionField],
    {
      canonicalUrl,
      description,
      price: {
        amount: Number.isFinite(amount) ? amount : 0,
        currencyCode,
        precision,
        raw: priceRaw
      }
    },
    {
      canonicalUrl,
      description,
      price: priceRaw
    }
  );

  // Iteration 3: capture gallery, rating, breadcrumbs, thumbnail, and SKU selectors
  const imageResult = await toolset.html.query({
    selector: '[data-test="gallery-image"]',
    attribute: 'src',
    limit: 12
  });
  const images = imageResult.matches
    .map((match) => toAbsoluteUrl(match.attributeValue, baseUrl))
    .filter((value): value is string => typeof value === 'string');
  if (images.length === 0) {
    throw new Error('Agent workflow failed to locate gallery images.');
  }
  const thumbnail = images[0] ?? undefined;

  const ratingResult = await toolset.html.query({ selector: '[data-test="aggregate-rating"]', limit: 1 });
  const ratingHtml = ratingResult.matches[0]?.html ?? '';
  const ratingDoc = load(ratingHtml || '<div></div>');
  const ratingValue = Number.parseFloat(collapseWhitespace(ratingDoc('.rating__value').text() ?? ''));
  const reviewCountText = collapseWhitespace(ratingDoc('.rating__count').text() ?? '');
  const reviewCount = Number.parseInt(reviewCountText.replace(/[^0-9]/g, ''), 10);
  const bestRatingText = collapseWhitespace(ratingDoc('.rating__best').text() ?? '');
  const bestRating = Number.parseFloat(bestRatingText.replace(/[^0-9.]/g, ''));

  const aggregateRating: Product['aggregateRating'] | undefined = Number.isFinite(ratingValue)
    ? {
        ratingValue,
        ...(Number.isFinite(reviewCount) ? { reviewCount } : {}),
        ...(Number.isFinite(bestRating) ? { bestRating } : {}),
        ...(canonicalUrl ? { url: `${canonicalUrl}#reviews` } : {})
      }
    : undefined;

  const breadcrumbsResult = await toolset.html.query({ selector: 'nav.breadcrumbs ol li', limit: 8 });
  const breadcrumbs = breadcrumbsResult.matches.map((match) => {
    const snippet = load(match.html ?? '<li></li>');
    const link = snippet('a').first();
    const label = collapseWhitespace(match.text);
    const href = link.attr('href');
    const resolved = href ? toAbsoluteUrl(href, baseUrl) : undefined;
    return resolved ? { label, url: resolved } : { label };
  });

  const skuResult = await toolset.html.query({ selector: '[data-test="sku"]', limit: 1 });
  const rawSku = collapseWhitespace(skuResult.matches[0]?.text ?? '');
  const sku = sanitizeSku(rawSku);

  const imagesField = createFieldRecipe('images', '[data-test="gallery-image"]', {
    note: 'Gallery images resolved to absolute URLs.',
    attribute: 'src',
    all: true,
    transforms: [{ name: 'url.resolve' }],
    validators: [{ type: 'minLength', value: 1 }],
    sample: images
  });

  const thumbnailField = createFieldRecipe('thumbnail', '[data-test="gallery-image"][data-position="1"]', {
    note: 'Use the first gallery image as the thumbnail.',
    attribute: 'src',
    transforms: [{ name: 'url.resolve' }],
    validators: [{ type: 'required' }],
    sample: thumbnail ?? images[0]
  });

  const ratingField = createFieldRecipe('aggregateRating', '[data-test="aggregate-rating"]', {
    note: 'Aggregate rating widget providing value and count.',
    sample: aggregateRating,
    validators: [],
    transforms: []
  });

  const breadcrumbsField = createFieldRecipe('breadcrumbs', 'nav.breadcrumbs ol li', {
    note: 'Breadcrumb ordered list items.',
    all: true,
    validators: [{ type: 'minLength', value: 1 }],
    transforms: [],
    sample: breadcrumbs
  });

  const skuField = createFieldRecipe('sku', '[data-test="sku"]', {
    note: 'Footer SKU indicator.',
    transforms: [{ name: 'text.collapse' }],
    sample: sku
  });

  addEvidence('images', imageResult.matches[0]?.attributeValue, 0.8, 'hero');
  addEvidence('thumbnail', imageResult.matches[0]?.attributeValue, 0.8, 'hero');
  addEvidence('aggregateRating', ratingResult.matches[0]?.text, 0.75, 'hero');
  addEvidence('breadcrumbs', breadcrumbsResult.matches[0]?.text, 0.7, 'breadcrumbs');
  addEvidence('sku', skuResult.matches[0]?.text, 0.6);

  recordIteration(
    3,
    'Expanded selectors to gallery, rating, breadcrumbs, and SKU to complete the product target.',
    [imagesField, thumbnailField, ratingField, breadcrumbsField, skuField],
    {
      images,
      thumbnail: thumbnail ?? images[0],
      aggregateRating,
      breadcrumbs,
      sku
    },
    {
      images,
      thumbnail: thumbnail ?? images[0],
      aggregateRating,
      breadcrumbs,
      sku
    }
  );

  const targetProduct = ProductSchema.parse({
    title: partialTarget.title,
    canonicalUrl: partialTarget.canonicalUrl,
    description: partialTarget.description,
    price: partialTarget.price,
    images: Array.isArray(partialTarget.images) ? partialTarget.images : images,
    thumbnail: partialTarget.thumbnail ?? thumbnail ?? images[0],
    aggregateRating: aggregateRating ?? undefined,
    breadcrumbs,
    brand: partialTarget.brand,
    sku
  });

  const timestamp = now.toISOString();
  const fields = Array.from(fieldRecipes.values());
  if (!fields.length) {
    throw new Error('Agent workflow failed to synthesize field selectors.');
  }

  const recipe = RecipeSchema.parse({
    name: `Generated recipe for ${document.domain}${document.path}`,
    version: '0.1.0-agent',
    description: 'Selector recipe synthesized via iterative agent workflow.',
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: 'agent-workflow',
    updatedBy: 'agent-workflow',
    target: {
      documentType: 'product' as const,
      schema: targetProduct,
      fields
    },
    lifecycle: {
      state: 'draft' as const,
      since: timestamp,
      history: [
        {
          state: 'draft' as const,
          at: timestamp,
          actor: 'agent-workflow',
          notes: 'Initial recipe synthesized via iterative agent loop.'
        }
      ]
    },
    metrics: { totalRuns: 0, successfulRuns: 0 },
    provenance: fields.map((field) => {
      const evidence = evidenceMap.get(field.fieldId);
      return {
        fieldId: field.fieldId,
        evidence: field.selectorSteps.map((step) => step.value).join(' | '),
        confidence: evidence?.confidence ?? 0.6,
        notes: field.selectorSteps[0]?.note
      };
    })
  });

  const expected: ExpectedDataSummary = {
    fixtureId: `${document.domain}${document.path}`,
    product: targetProduct,
    ocrTranscript: ocrResult.lines,
    supportingEvidence: Array.from(evidenceMap.entries()).map(([fieldId, entry]) => ({
      fieldId,
      source: 'html',
      snippet: entry.snippet,
      confidence: entry.confidence,
      chunkId: entry.chunkId
    })),
    origin: 'agent'
  };

  const evidenceMatrix = fields.map((field) => {
    const evidence = evidenceMap.get(field.fieldId);
    return {
      fieldId: field.fieldId,
      source: 'html' as const,
      selectors: field.selectorSteps.map((step) => step.value),
      chunkId: evidence?.chunkId,
      notes: field.selectorSteps[0]?.note
    };
  });

  const synthesis: RecipeSynthesisSummary = {
    recipe,
    evidenceMatrix,
    iterations,
    origin: 'agent'
  };

  return { expected, synthesis };
};
