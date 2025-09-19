import { load, type CheerioAPI } from 'cheerio';

import {
  ProductSchema,
  RecipeSchema,
  getDefaultTolerance,
  type FieldRecipe,
  type Product,
  type RecipeFieldId
} from '@mercator/core';
import type { FixtureToolset, HtmlQueryMatch, HtmlQueryResult } from '@mercator/agent-tools';
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

const attributePriorities = [
  'data-test',
  'data-testid',
  'data-qa',
  'data-role',
  'itemprop',
  'itemtype',
  'itemid',
  'data-component',
  'data-field',
  'aria-label',
  'rel',
  'name',
  'property'
] as const;

const attributeSelectorAttributes = [
  'data-test',
  'data-testid',
  'data-qa',
  'data-role',
  'aria-label',
  'id',
  'class',
  'name',
  'itemprop',
  'property'
] as const;

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

const toSearchTokens = (value: string): readonly string[] =>
  collapseWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

const normalizeRegex = (pattern: RegExp | undefined): RegExp | undefined => {
  if (!pattern) {
    return undefined;
  }
  const flags = pattern.flags.replace(/g/g, '');
  return new RegExp(pattern.source, flags);
};

interface HtmlElementNode {
  readonly type?: string;
  readonly name?: string;
  readonly attribs?: Record<string, string | undefined>;
  readonly parent?: HtmlElementNode | null;
  readonly children?: readonly HtmlElementNode[];
}

const isTagNode = (node: HtmlElementNode | null | undefined): node is HtmlElementNode =>
  Boolean(node && node.type === 'tag');

const matchesSibling = (
  node: HtmlElementNode | undefined,
  name: string | undefined
): node is HtmlElementNode => Boolean(node && node.type === 'tag' && node.name === name);

const buildCssPath = ($: CheerioAPI, element: HtmlElementNode): string => {
  const segments: string[] = [];
  let current: HtmlElementNode | null = element;

  while (isTagNode(current)) {
    const tagName = current.name ?? '';
    if (!tagName) {
      break;
    }

    const attributes = current.attribs ?? {};
    let segment = tagName;

    const prioritizedAttribute = attributePriorities.find((attribute) => attributes[attribute]);
    if (prioritizedAttribute) {
      const value = attributes[prioritizedAttribute];
      segment += `[${prioritizedAttribute}="${value}"]`;
      segments.push(segment);
      break;
    }

    if (attributes.id) {
      segment += `#${attributes.id}`;
      segments.push(segment);
      break;
    }

    if (attributes.class) {
      const [firstClass] = attributes.class
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      if (firstClass) {
        segment += `.${firstClass}`;
      }
    }

    const parent = isTagNode(current.parent) ? current.parent : null;
    if (parent && isTagNode(current) && current.name) {
      let ordinal = 0;
      let total = 0;
      const children = (parent.children ?? []) as readonly HtmlElementNode[];
      children.forEach((child) => {
        if (matchesSibling(child, current.name)) {
          total += 1;
          if (child === current) {
            ordinal = total;
          }
        }
      });
      if (total > 1 && ordinal > 0) {
        segment += `:nth-of-type(${ordinal})`;
      }
    }

    segments.push(segment);
    current = parent;
  }

  return segments.reverse().join(' > ');
};

const createAttributeSelectors = (keyword: string, tags?: readonly string[]): readonly string[] => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const selectors = new Set<string>();
  const wrap = (selector: string) => {
    if (tags && tags.length > 0) {
      tags.forEach((tag) => selectors.add(`${tag}${selector}`));
    }
    selectors.add(selector);
  };

  attributeSelectorAttributes.forEach((attribute) => {
    wrap(`[${attribute}*="${normalized}"]`);
    wrap(`[${attribute}="${normalized}"]`);
  });

  return Array.from(selectors);
};

const uniqueSelectors = (selectors: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  selectors.forEach((selector) => {
    const trimmed = selector.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    ordered.push(trimmed);
  });
  return ordered;
};

const findMatchingSelector = async (
  toolset: FixtureToolset,
  selectors: readonly string[],
  options: {
    readonly limit?: number;
    readonly attribute?: string;
    readonly predicate: (matches: readonly HtmlQueryMatch[]) => boolean;
  }
): Promise<{ selector: string; result: HtmlQueryResult } | undefined> => {
  for (const selector of selectors) {
    try {
      const result = await toolset.html.query({
        selector,
        limit: options.limit ?? 5,
        attribute: options.attribute
      });
      if (!result.matches.length) {
        continue;
      }
      if (options.predicate(result.matches)) {
        return { selector, result };
      }
    } catch {
      // Ignore selectors that Cheerio cannot parse.
    }
  }
  return undefined;
};

interface ElementSelectionOptions {
  readonly seeds?: readonly string[];
  readonly attributeHints?: readonly string[];
  readonly preferTags?: readonly string[];
  readonly allowedTags?: readonly string[];
  readonly textPattern?: RegExp;
  readonly allowPartialMatches?: boolean;
}

const selectElement = (
  $: CheerioAPI,
  options: ElementSelectionOptions
): HtmlElementNode | undefined => {
  const tokens = (options.seeds ?? []).flatMap(toSearchTokens);
  const attributeHints = (options.attributeHints ?? []).map((hint) => hint.toLowerCase());
  const preferTags = new Set((options.preferTags ?? []).map((tag) => tag.toLowerCase()));
  const allowedTags = options.allowedTags
    ? new Set(options.allowedTags.map((tag) => tag.toLowerCase()))
    : undefined;
  const pattern = normalizeRegex(options.textPattern);

  const nodes = $('*').toArray() as HtmlElementNode[];
  let best: { element: HtmlElementNode; score: number } | undefined;

  for (const node of nodes) {
    if (!isTagNode(node)) {
      continue;
    }
    const element = node;
    const tagName = element.name?.toLowerCase();
    if (!tagName) {
      continue;
    }
    if (allowedTags && !allowedTags.has(tagName)) {
      continue;
    }

    const selection = $(element);
    const text = collapseWhitespace(selection.text() ?? '');
    const normalizedText = text.toLowerCase();

    if (pattern && !pattern.test(text)) {
      continue;
    }

    let score = 0;
    let matchedTokenCount = 0;
    if (tokens.length) {
      const matches = tokens.filter((token) => normalizedText.includes(token));
      if (!options.allowPartialMatches && matches.length !== tokens.length) {
        continue;
      }
      if (!matches.length) {
        continue;
      }
      matchedTokenCount = matches.length;
      score += matches.reduce((total, token) => total + Math.min(token.length, 8), 0);
      const lengthDiff = Math.abs(normalizedText.length - tokens.join(' ').length);
      score -= Math.min(lengthDiff, 60) * 0.05;
    }

    const attributes = element.attribs ?? {};
    attributeHints.forEach((hint) => {
      Object.entries(attributes).forEach(([name, value]) => {
        const lowerName = name.toLowerCase();
        const lowerValue = (value ?? '').toLowerCase();
        if (lowerName.includes(hint)) {
          score += 3;
        }
        if (lowerValue.includes(hint)) {
          score += 4;
        }
      });
    });

    if (preferTags.has(tagName)) {
      score += 3;
    }

    if (attributes['data-test']) {
      score += 2;
    }
    if (attributes.id) {
      score += 2;
    }

    if (score <= 0) {
      if (matchedTokenCount > 0) {
        score += matchedTokenCount * 2;
      } else {
        continue;
      }
    }

    if (!best || score > best.score) {
      best = { element, score };
    }
  }

  return best?.element;
};

interface SelectorDerivationOptions {
  readonly field: RecipeFieldId;
  readonly keywords?: readonly string[];
  readonly fallbackText?: readonly string[];
  readonly preferTags?: readonly string[];
  readonly allowedTags?: readonly string[];
  readonly additionalSelectors?: readonly string[];
  readonly directSelectors?: readonly string[];
  readonly textPattern?: RegExp;
  readonly limit?: number;
  readonly attribute?: string;
  readonly allowPartialMatches?: boolean;
  readonly selectorLimit?: number;
  readonly predicate: (matches: readonly HtmlQueryMatch[]) => boolean;
}

const deriveSelector = async (
  $: CheerioAPI,
  toolset: FixtureToolset,
  options: SelectorDerivationOptions
): Promise<{ selector: string; result: HtmlQueryResult }> => {
  const selectors: string[] = [];
  if (options.directSelectors) {
    selectors.push(...options.directSelectors);
  }
  if (options.keywords) {
    options.keywords.forEach((keyword) => {
      selectors.push(...createAttributeSelectors(keyword, options.preferTags));
      selectors.push(...createAttributeSelectors(keyword));
    });
  }
  if (options.additionalSelectors) {
    selectors.unshift(...options.additionalSelectors);
  }

  const selectorLimit = options.selectorLimit ?? 8;
  const limitedSelectors = uniqueSelectors(selectors).slice(0, selectorLimit);

  const candidate = await findMatchingSelector(toolset, limitedSelectors, {
    limit: options.limit,
    attribute: options.attribute,
    predicate: options.predicate
  });
  if (candidate) {
    return candidate;
  }

  const fallbackSeeds = (options.fallbackText ?? []).filter(Boolean);
  if (fallbackSeeds.length || (options.keywords && options.keywords.length)) {
    const element = selectElement($, {
      seeds: fallbackSeeds,
      attributeHints: options.keywords,
      preferTags: options.preferTags,
      allowedTags: options.allowedTags,
      textPattern: options.textPattern,
      allowPartialMatches: options.allowPartialMatches
    });
    if (element) {
      const selector = buildCssPath($, element);
      const result = await toolset.html.query({
        selector,
        limit: options.limit ?? 5,
        attribute: options.attribute
      });
      if (result.matches.length && options.predicate(result.matches)) {
        return { selector, result };
      }
    }
  }

  throw new Error(`Agent workflow failed to derive a selector for ${options.field}.`);
};

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
  const $ = load(document.html);
  const ocrResult = await toolset.vision.readOcr();
  await toolset.html.listChunks();

  const evidenceMap = new Map<RecipeFieldId, EvidenceEntry>();
  const fieldRecipes = new Map<RecipeFieldId, FieldRecipe>();
  let partialTarget: Partial<Product> = {};
  const iterations: AgentIterationLogEntry[] = [];

  const addEvidence = (
    fieldId: RecipeFieldId,
    snippet: string | undefined,
    confidence: number,
    chunkId?: string
  ) => {
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

  const ocrLines = ocrResult.lines.map(collapseWhitespace).filter(Boolean);
  const titleSeed = ocrLines[0] ?? '';
  const brandSeed =
    ocrLines.find((line) => /brand|labs|co\b|inc\b|llc\b|shop/i.test(line)) ?? ocrLines[1] ?? '';
  const priceSeed =
    ocrLines.find((line) => /(\$|€|£|USD|EUR|GBP|JPY|AUD|CAD)/i.test(line) && /\d/.test(line)) ?? '';

  const titleTokens = toSearchTokens(titleSeed);
  const titleSelector = await deriveSelector($, toolset, {
    field: 'title',
    keywords: ['title', 'headline', 'product'],
    fallbackText: titleSeed ? [titleSeed] : [],
    preferTags: ['h1', 'h2', 'p'],
    predicate: (matches) => {
      const text = collapseWhitespace(matches[0]?.text ?? '').toLowerCase();
      return titleTokens.length ? titleTokens.every((token) => text.includes(token)) : Boolean(text);
    },
    directSelectors: ['h1'],
    selectorLimit: 6
  });
  const titleText = collapseWhitespace(titleSelector.result.matches[0]?.text ?? titleSeed);
  if (!titleText) {
    throw new Error('Agent workflow failed to locate a product title.');
  }
  const titleField = createFieldRecipe('title', titleSelector.selector, {
    note: 'Matched OCR headline tokens against hero element.',
    transforms: [{ name: 'text.collapse' }],
    validators: [{ type: 'required' }],
    sample: titleText
  });
  addEvidence('title', titleSelector.result.matches[0]?.text, 0.85, titleSelector.result.chunk?.id);

  const brandTokens = toSearchTokens(brandSeed);
  const brandSelector = await deriveSelector($, toolset, {
    field: 'brand',
    keywords: ['brand', 'eyebrow', 'maker'],
    fallbackText: brandSeed ? [brandSeed] : [],
    preferTags: ['p', 'span'],
    predicate: (matches) => {
      const text = collapseWhitespace(matches[0]?.text ?? '').toLowerCase();
      return brandTokens.length ? brandTokens.every((token) => text.includes(token)) : Boolean(text);
    },
    selectorLimit: 6
  });
  const brandText = collapseWhitespace(brandSelector.result.matches[0]?.text ?? brandSeed);
  const brandField = createFieldRecipe('brand', brandSelector.selector, {
    note: 'Located brand label adjacent to headline using OCR keywords.',
    transforms: [{ name: 'text.collapse' }],
    sample: brandText
  });
  addEvidence('brand', brandSelector.result.matches[0]?.text, 0.75, brandSelector.result.chunk?.id);

  const priceSelector = await deriveSelector($, toolset, {
    field: 'price',
    keywords: ['price', 'amount', 'offer', 'cost'],
    fallbackText: priceSeed ? [priceSeed] : [],
    preferTags: ['p', 'div', 'span'],
    textPattern: /(\$|€|£|¥|USD|EUR|GBP|JPY|AUD|CAD)/i,
    predicate: (matches) =>
      matches.some((match) => /(\$|€|£|¥|USD|EUR|GBP|JPY|AUD|CAD)/i.test(match.text) && /\d/.test(match.text)),
    selectorLimit: 8
  });
  const priceText = collapseWhitespace(priceSelector.result.matches[0]?.text ?? priceSeed);
  const symbolMatch = /[$€£¥]/.exec(priceText);
  const currencySymbol = symbolMatch?.[0] ?? '$';
  const amountMatch = /([0-9][0-9.,]*)/.exec(priceText);
  const amountText = amountMatch?.[1]?.replace(/,/g, '') ?? '0';
  const currencyCodeMatch = /(USD|EUR|GBP|JPY|AUD|CAD)/i.exec(priceText);
  const currencyCode = (currencyCodeMatch?.[1] ?? 'USD').toUpperCase();
  const precision = inferPrecision(amountText);
  const priceRaw = `${currencySymbol}${amountText}`;
  const priceField = createFieldRecipe('price', priceSelector.selector, {
    note: 'Identified price container with currency tokens and numeric amount.',
    transforms: [
      { name: 'text.collapse' },
      { name: 'money.parse', options: { currencyCode } }
    ],
    validators: [{ type: 'required' }],
    sample: {
      amount: Number.parseFloat(amountText) || 0,
      currencyCode,
      precision,
      raw: priceRaw
    }
  });
  addEvidence('price', priceSelector.result.matches[0]?.text, 0.8, priceSelector.result.chunk?.id);

  recordIteration(
    1,
    'Used OCR transcript to locate hero title, brand label, and price container by matching text tokens against attribute hints.',
    [titleField, brandField, priceField],
    {
      title: titleText,
      brand: brandText,
      price: {
        amount: Number.parseFloat(amountText) || 0,
        currencyCode,
        precision,
        raw: priceRaw
      }
    },
    {
      title: titleText,
      brand: brandText,
      price: priceRaw
    }
  );

  const canonicalSelector = await deriveSelector($, toolset, {
    field: 'canonicalUrl',
    keywords: ['canonical'],
    allowedTags: ['link'],
    additionalSelectors: ['link[rel="canonical"]', 'head link[rel*="canonical"]'],
    attribute: 'href',
    limit: 1,
    predicate: (matches) => matches.some((match) => Boolean(match.attributeValue ?? match.attributes.href)),
    selectorLimit: 6
  });
  const canonicalHref = canonicalSelector.result.matches[0]?.attributeValue ?? canonicalSelector.result.matches[0]?.attributes.href;
  const canonicalUrl = canonicalHref ? toAbsoluteUrl(canonicalHref, baseUrl) ?? baseUrl.toString() : baseUrl.toString();
  const canonicalField = createFieldRecipe('canonicalUrl', canonicalSelector.selector, {
    note: 'Inspected head links for canonical relation and normalized the absolute URL.',
    attribute: 'href',
    transforms: [{ name: 'url.resolve', options: { enforceHttps: true } }],
    validators: [{ type: 'required' }],
    sample: canonicalUrl
  });
  addEvidence('canonicalUrl', canonicalHref, 0.7);

  const descriptionSelector = await deriveSelector($, toolset, {
    field: 'description',
    keywords: ['description'],
    allowedTags: ['meta'],
    additionalSelectors: ['meta[name="description"]', 'meta[name*="description"]'],
    attribute: 'content',
    limit: 1,
    predicate: (matches) => Boolean(matches[0]?.attributeValue ?? matches[0]?.attributes.content),
    selectorLimit: 6
  });
  const descriptionContent =
    descriptionSelector.result.matches[0]?.attributeValue ??
    descriptionSelector.result.matches[0]?.attributes.content ??
    '';
  const description = collapseWhitespace(descriptionContent);
  const descriptionField = createFieldRecipe('description', descriptionSelector.selector, {
    note: 'Captured long-form copy from meta description content attribute.',
    attribute: 'content',
    transforms: [{ name: 'text.collapse' }],
    validators: [{ type: 'minLength', value: 20 }],
    sample: description
  });
  addEvidence('description', descriptionContent, 0.65);

  const imageSelector = await deriveSelector($, toolset, {
    field: 'images',
    keywords: ['gallery', 'image', 'product'],
    preferTags: ['img'],
    additionalSelectors: ['figure img'],
    attribute: 'src',
    limit: 12,
    predicate: (matches) => matches.length > 0 && matches.every((match) => Boolean(match.attributeValue ?? match.attributes.src)),
    selectorLimit: 6
  });
  const imageSources = imageSelector.result.matches
    .map((match) => toAbsoluteUrl(match.attributeValue ?? match.attributes.src, baseUrl))
    .filter((value): value is string => Boolean(value));
  if (!imageSources.length) {
    throw new Error('Agent workflow failed to locate gallery images.');
  }
  const imagesField = createFieldRecipe('images', imageSelector.selector, {
    note: 'Found gallery images by scanning for img nodes tagged as gallery content.',
    attribute: 'src',
    all: true,
    transforms: [{ name: 'url.resolve' }],
    validators: [{ type: 'minLength', value: 1 }],
    sample: imageSources
  });
  addEvidence('images', imageSelector.result.matches[0]?.attributeValue, 0.75, imageSelector.result.chunk?.id);

  const firstImageMatch = imageSelector.result.matches[0];
  const thumbnailSelector = firstImageMatch?.attributes['data-position']
    ? `${imageSelector.selector}[data-position="${firstImageMatch.attributes['data-position']}"]`
    : imageSelector.selector;
  const thumbnailQuery = await toolset.html.query({ selector: thumbnailSelector, attribute: 'src', limit: 1 });
  const thumbnailSource = toAbsoluteUrl(
    thumbnailQuery.matches[0]?.attributeValue ?? thumbnailQuery.matches[0]?.attributes.src,
    baseUrl
  ) ?? imageSources[0];
  const thumbnailField = createFieldRecipe('thumbnail', thumbnailSelector, {
    note: 'Selected first gallery image as thumbnail after verifying selector matches.',
    attribute: 'src',
    transforms: [{ name: 'url.resolve' }],
    validators: [{ type: 'required' }],
    sample: thumbnailSource
  });
  addEvidence('thumbnail', thumbnailQuery.matches[0]?.attributeValue, 0.75, thumbnailQuery.chunk?.id);

  recordIteration(
    2,
    'Inspected document head for canonical metadata and captured gallery selectors to build media context.',
    [canonicalField, descriptionField, imagesField, thumbnailField],
    {
      canonicalUrl,
      description,
      images: imageSources,
      thumbnail: thumbnailSource
    },
    {
      canonicalUrl,
      description,
      images: imageSources,
      thumbnail: thumbnailSource
    }
  );

  const ratingSelector = await deriveSelector($, toolset, {
    field: 'aggregateRating',
    keywords: ['rating', 'reviews', 'score'],
    preferTags: ['div', 'section'],
    predicate: (matches) => matches.some((match) => /\d/.test(match.text) || /rating/i.test(match.html ?? '')),
    additionalSelectors: ['[itemprop="aggregateRating"]'],
    selectorLimit: 8
  });
  const ratingHtml = ratingSelector.result.matches[0]?.html ?? '';
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
  const ratingField = createFieldRecipe('aggregateRating', ratingSelector.selector, {
    note: 'Analyzed rating widget tagged with review metadata to extract aggregate rating summary.',
    sample: aggregateRating,
    validators: [],
    transforms: []
  });
  addEvidence('aggregateRating', ratingSelector.result.matches[0]?.text, 0.7, ratingSelector.result.chunk?.id);

  const breadcrumbsSelector = await deriveSelector($, toolset, {
    field: 'breadcrumbs',
    keywords: ['breadcrumb', 'breadcrumbs'],
    additionalSelectors: [
      'nav[aria-label*="breadcrumb"] li',
      'nav[class*="breadcrumb"] li',
      'ol[class*="breadcrumb"] li'
    ],
    predicate: (matches) => matches.length > 0,
    limit: 8,
    selectorLimit: 6
  });
  const breadcrumbs = breadcrumbsSelector.result.matches.map((match) => {
    const snippet = load(match.html ?? '<li></li>');
    const link = snippet('a').first();
    const label = collapseWhitespace(match.text);
    const href = link.attr('href');
    const resolved = href ? toAbsoluteUrl(href, baseUrl) : undefined;
    return resolved ? { label, url: resolved } : { label };
  });
  const breadcrumbsField = createFieldRecipe('breadcrumbs', breadcrumbsSelector.selector, {
    note: 'Traced breadcrumb navigation items for hierarchical context.',
    all: true,
    validators: [{ type: 'minLength', value: 1 }],
    transforms: [],
    sample: breadcrumbs
  });
  addEvidence('breadcrumbs', breadcrumbsSelector.result.matches[0]?.text, 0.65, breadcrumbsSelector.result.chunk?.id);

  const skuSelector = await deriveSelector($, toolset, {
    field: 'sku',
    keywords: ['sku', 'product-sku'],
    preferTags: ['p', 'span', 'li'],
    predicate: (matches) => matches.some((match) => /sku/i.test(match.text)),
    allowPartialMatches: true,
    selectorLimit: 6
  });
  const skuText = collapseWhitespace(skuSelector.result.matches[0]?.text ?? '');
  const sku = sanitizeSku(skuText);
  const skuField = createFieldRecipe('sku', skuSelector.selector, {
    note: 'Located SKU label in footer content using attribute hints and text normalization.',
    transforms: [{ name: 'text.collapse' }],
    sample: sku
  });
  addEvidence('sku', skuSelector.result.matches[0]?.text, 0.6, skuSelector.result.chunk?.id);

  recordIteration(
    3,
    'Completed supporting context by analyzing rating widget, breadcrumb trail, and SKU footer label.',
    [ratingField, breadcrumbsField, skuField],
    {
      aggregateRating,
      breadcrumbs,
      sku
    },
    {
      aggregateRating,
      breadcrumbs,
      sku
    }
  );

  const targetProduct = ProductSchema.parse({
    title: partialTarget.title ?? titleText,
    canonicalUrl,
    description,
    price: partialTarget.price ?? {
      amount: Number.parseFloat(amountText) || 0,
      currencyCode,
      precision,
      raw: priceRaw
    },
    images: Array.isArray(partialTarget.images) ? partialTarget.images : imageSources,
    thumbnail: partialTarget.thumbnail ?? thumbnailSource,
    aggregateRating: aggregateRating ?? undefined,
    breadcrumbs,
    brand: partialTarget.brand ?? brandText,
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
