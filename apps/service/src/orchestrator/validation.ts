import { load, type CheerioAPI } from 'cheerio';
import { ZodError } from 'zod';

import { ProductSchema, type Product, type Money, applyTransform } from '@mercator/core';
import type { FieldRecipe, Recipe } from '@mercator/core';
import type { RecipeTolerance } from '@mercator/core';
import type { DocumentValidationResult, FieldValidationResult } from '@mercator/core/agents';

const FIELD_TO_PRODUCT_KEY: Record<FieldRecipe['fieldId'], keyof Product | null> = {
  id: 'id',
  title: 'title',
  canonicalUrl: 'canonicalUrl',
  description: 'description',
  price: 'price',
  images: 'images',
  thumbnail: 'thumbnail',
  aggregateRating: 'aggregateRating',
  breadcrumbs: 'breadcrumbs',
  brand: 'brand',
  sku: 'sku'
};

const REQUIRED_FIELDS: FieldRecipe['fieldId'][] = ['title', 'canonicalUrl', 'price', 'images'];

const clampConfidence = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  const rows = a.length + 1;
  const cols = b.length + 1;

  for (let i = 0; i < rows; i += 1) {
    matrix[i] = [i];
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1], matrix[i - 1][j], matrix[i][j - 1]) + 1;
      }
    }
  }

  return matrix[rows - 1][cols - 1];
};

const normalizeText = (value: string, options: { trim: boolean; caseSensitive: boolean }): string => {
  const trimmed = options.trim ? value.trim() : value;
  const collapsed = trimmed.replace(/\s+/g, ' ');
  return options.caseSensitive ? collapsed : collapsed.toLowerCase();
};

const normalizeUrl = (value: string, options: { ignoreQuery: boolean; normalizeTrailingSlash: boolean }): string => {
  try {
    const parsed = new URL(value);
    if (options.ignoreQuery) {
      parsed.search = '';
    }
    if (options.normalizeTrailingSlash) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '/');
    }
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

const toMinorUnits = (money: Money): number => {
  const factor = 10 ** money.precision;
  return Math.round(money.amount * factor);
};

const isMoneyValue = (value: unknown): value is Money => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { amount?: unknown }).amount === 'number' &&
    typeof (value as { currencyCode?: unknown }).currencyCode === 'string'
  );
};

const isStringArray = (value: unknown): value is readonly string[] => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

interface RatingLike {
  ratingValue: number;
  reviewCount?: number;
  bestRating?: number;
  url?: string;
}

interface BreadcrumbLike {
  label: string;
  url?: string;
  position?: number;
}

const isAggregateRatingValue = (value: unknown): value is RatingLike => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { ratingValue?: unknown }).ratingValue === 'number'
  );
};

const isBreadcrumbArray = (value: unknown): value is readonly BreadcrumbLike[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { label?: unknown }).label === 'string'
    )
  );
};

const extractBreadcrumbs = ($: CheerioAPI): BreadcrumbLike[] => {
  const items: BreadcrumbLike[] = [];
  $('nav.breadcrumbs ol li').each((index, element) => {
    const node = $(element);
    const link = node.find('a').first();
    const label = node.text().replace(/\s+/g, ' ').trim();
    const url = link.attr('href') ?? undefined;
    items.push({ label, url, position: index + 1 });
  });
  return items;
};

const extractAggregateRating = (
  $: CheerioAPI,
  canonicalUrl: string
): RatingLike | undefined => {
  const container = $('[data-test="aggregate-rating"]');
  if (!container.length) {
    return undefined;
  }

  const ratingValueText = container.find('.rating__value').text();
  const ratingValue = Number.parseFloat(ratingValueText);
  if (!Number.isFinite(ratingValue)) {
    return undefined;
  }

  const reviewCountText = container.find('.rating__count').text();
  const reviewCount = Number.parseInt(reviewCountText.replace(/[^0-9]/g, ''), 10);
  const bestRatingText = container.find('.rating__best').text();
  const bestRating = Number.parseFloat(bestRatingText.replace(/[^0-9.]/g, ''));

  const aggregate: RatingLike = {
    ratingValue,
    url: `${canonicalUrl}#reviews`
  };

  if (Number.isFinite(reviewCount)) {
    aggregate.reviewCount = reviewCount;
  }

  if (Number.isFinite(bestRating)) {
    aggregate.bestRating = bestRating;
  }

  return aggregate;
};

const applyTransforms = (field: FieldRecipe, value: unknown): unknown => {
  return field.transforms.reduce<unknown>((current, transform) => {
    if (Array.isArray(current)) {
      return current.map((entry) => applyTransform(transform.name, entry, transform.options));
    }
    return applyTransform(transform.name, current, transform.options);
  }, value);
};

const sanitizeSku = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/^sku:\s*/i, '').trim();
};

const adjustMoneyRaw = (value: Money, expected: Money): Money => {
  const raw = expected.raw ?? `$${value.amount.toFixed(value.precision)}`;
  return { ...value, raw };
};

const compareText = (
  expected: string,
  actual: string,
  tolerance: Extract<RecipeTolerance, { kind: 'text' }>
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  const normalizedExpected = normalizeText(expected, {
    trim: tolerance.trim ?? true,
    caseSensitive: tolerance.caseSensitive ?? false
  });
  const normalizedActual = normalizeText(actual, {
    trim: tolerance.trim ?? true,
    caseSensitive: tolerance.caseSensitive ?? false
  });
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length, 1);
  const ratio = distance / maxLength;
  const pass = ratio <= (tolerance.maxDistanceRatio ?? 0);
  const confidence = clampConfidence(1 - ratio);
  const notes = [`Levenshtein ratio ${ratio.toFixed(3)} (threshold ${tolerance.maxDistanceRatio ?? 0})`];
  const errors = pass ? [] : [`Text difference ${ratio.toFixed(3)} exceeds tolerance`];
  return { status: pass ? 'pass' : 'fail', confidence, notes, errors };
};

const compareMoney = (
  expected: Money,
  actual: Money,
  tolerance: Extract<RecipeTolerance, { kind: 'money' }>
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  const expectedMinor = toMinorUnits(expected);
  const actualMinor = toMinorUnits(actual);
  const diffMinor = Math.abs(expectedMinor - actualMinor);
  const relative = expected.amount === 0 ? 0 : Math.abs(expected.amount - actual.amount) / expected.amount;
  const withinAbsolute = diffMinor <= (tolerance.maxAbsoluteMinorUnits ?? 0);
  const withinRelative = relative <= (tolerance.maxRelativeDifference ?? 0);
  const pass = withinAbsolute && withinRelative;
  const confidence = clampConfidence(pass ? 1 - relative : Math.max(0, 1 - relative));
  const notes = [`Minor unit delta ${diffMinor}`, `Relative delta ${relative.toFixed(3)}`];
  const errors = pass
    ? []
    : [`Price delta ${diffMinor} minor units, relative ${relative.toFixed(3)} exceeds tolerance`];
  return { status: pass ? 'pass' : 'fail', confidence, notes, errors };
};

const compareUrl = (
  expected: string,
  actual: string,
  tolerance: Extract<RecipeTolerance, { kind: 'url' | 'image' }>
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  const normalizedExpected = normalizeUrl(expected, {
    ignoreQuery: tolerance.kind === 'image' ? tolerance.ignoreQuery ?? true : tolerance.ignoreQuery ?? false,
    normalizeTrailingSlash: tolerance.kind === 'image' ? true : tolerance.normalizeTrailingSlash ?? true
  });
  const normalizedActual = normalizeUrl(actual, {
    ignoreQuery: tolerance.kind === 'image' ? tolerance.ignoreQuery ?? true : tolerance.ignoreQuery ?? false,
    normalizeTrailingSlash: tolerance.kind === 'image' ? true : tolerance.normalizeTrailingSlash ?? true
  });
  const pass = normalizedExpected === normalizedActual;
  const confidence = pass ? 1 : 0;
  const notes = [`Normalized expected ${normalizedExpected}`, `Normalized actual ${normalizedActual}`];
  const errors = pass ? [] : ['URLs differ after normalization'];
  return { status: pass ? 'pass' : 'fail', confidence, notes, errors };
};

const compareImageArray = (
  expected: readonly string[],
  actual: readonly string[],
  tolerance: Extract<RecipeTolerance, { kind: 'image' }>
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  const expectedNormalized = expected.map((value) => normalizeUrl(value, { ignoreQuery: tolerance.ignoreQuery ?? true, normalizeTrailingSlash: true }));
  const actualNormalized = actual.map((value) => normalizeUrl(value, { ignoreQuery: tolerance.ignoreQuery ?? true, normalizeTrailingSlash: true }));
  let matches = 0;
  expectedNormalized.forEach((value) => {
    if (actualNormalized.includes(value)) {
      matches += 1;
    }
  });
  const pass = matches === expectedNormalized.length;
  const confidence = clampConfidence(matches / Math.max(expectedNormalized.length, 1));
  const notes = [`Matched ${matches}/${expectedNormalized.length} images`];
  const errors = pass ? [] : [`Missing ${expectedNormalized.length - matches} expected images`];
  return { status: pass ? 'pass' : 'fail', confidence, notes, errors };
};

const compareRating = (
  expected: RatingLike,
  actual: RatingLike,
  tolerance: Extract<RecipeTolerance, { kind: 'rating' }>
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  if (expected.ratingValue === undefined || actual.ratingValue === undefined) {
    return {
      status: 'fail',
      confidence: 0,
      notes: [],
      errors: ['Missing rating value for comparison']
    };
  }

  const delta = Math.abs(expected.ratingValue - actual.ratingValue);
  const maxDelta = tolerance.maxDelta ?? 0;
  const pass = delta <= maxDelta;
  const normalized = maxDelta > 0 ? 1 - delta / maxDelta : delta === 0 ? 1 : 0;
  const confidence = clampConfidence(pass ? normalized : 0);
  const notes = [`Rating delta ${delta.toFixed(2)}`];
  const errors = pass ? [] : [`Rating delta ${delta.toFixed(2)} exceeds tolerance ${maxDelta}`];
  return { status: pass ? 'pass' : 'fail', confidence, notes, errors };
};

const compareBreadcrumbs = (
  expected: readonly BreadcrumbLike[],
  actual: readonly BreadcrumbLike[],
  tolerance: Extract<RecipeTolerance, { kind: 'breadcrumbs' }>
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  let matches = 0;
  expected.forEach((crumb, index) => {
    let candidate: BreadcrumbLike | undefined;
    if (tolerance.allowReordering) {
      candidate = actual.find(
        (entry) => entry.label.trim() === crumb.label.trim() && (entry.url ?? null) === (crumb.url ?? null)
      );
    } else {
      candidate = actual[index];
    }

    if (!candidate) {
      return;
    }

    if (candidate.label.trim() === crumb.label.trim() && (candidate.url ?? null) === (crumb.url ?? null)) {
      matches += 1;
    }
  });

  const missing = expected.length - matches;
  const pass = missing <= (tolerance.maxMissing ?? 0);
  const confidence = clampConfidence(matches / Math.max(expected.length, 1));
  const notes = [`Matched ${matches}/${expected.length} breadcrumbs`];
  const errors = pass ? [] : [`Missing ${missing} breadcrumbs exceeds tolerance ${tolerance.maxMissing ?? 0}`];
  return { status: pass ? 'pass' : 'fail', confidence, notes, errors };
};

const compareWithTolerance = (
  fieldId: FieldRecipe['fieldId'],
  expected: unknown,
  actual: unknown,
  tolerance: RecipeTolerance
): { status: 'pass' | 'fail'; confidence: number; notes: string[]; errors: string[] } => {
  if (expected === undefined || actual === undefined) {
    return {
      status: 'fail',
      confidence: 0,
      notes: [],
      errors: [`Missing expected or actual value for field ${fieldId}`]
    };
  }

  switch (tolerance.kind) {
    case 'text':
      if (typeof expected === 'string' && typeof actual === 'string') {
        return compareText(expected, actual, tolerance);
      }
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Expected string comparison for field ${fieldId}`]
      };
    case 'money':
      if (isMoneyValue(expected) && isMoneyValue(actual)) {
        return compareMoney(expected, actual, tolerance);
      }
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Expected monetary values for field ${fieldId}`]
      };
    case 'url':
      if (typeof expected === 'string' && typeof actual === 'string') {
        return compareUrl(expected, actual, tolerance);
      }
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Expected URL strings for field ${fieldId}`]
      };
    case 'image':
      if (isStringArray(expected) && isStringArray(actual)) {
        return compareImageArray(expected, actual, tolerance);
      }
      if (typeof expected === 'string' && typeof actual === 'string') {
        return compareUrl(expected, actual, tolerance);
      }
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Expected image values for field ${fieldId}`]
      };
    case 'rating':
      if (isAggregateRatingValue(expected) && isAggregateRatingValue(actual)) {
        return compareRating(expected, actual, tolerance);
      }
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Expected aggregate rating objects for field ${fieldId}`]
      };
    case 'breadcrumbs':
      if (isBreadcrumbArray(expected) && isBreadcrumbArray(actual)) {
        return compareBreadcrumbs(expected, actual, tolerance);
      }
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Expected breadcrumb arrays for field ${fieldId}`]
      };
    default:
      return {
        status: 'fail',
        confidence: 0,
        notes: [],
        errors: [`Unsupported tolerance kind ${(tolerance as { kind: string }).kind}`]
      };
  }
};

const getExpectedValue = (fieldId: FieldRecipe['fieldId'], expected: Product): unknown => {
  const key = FIELD_TO_PRODUCT_KEY[fieldId];
  if (!key) {
    return undefined;
  }
  return expected[key];
};

const getActualValue = (fieldId: FieldRecipe['fieldId'], actual: Product): unknown => {
  const key = FIELD_TO_PRODUCT_KEY[fieldId];
  if (!key) {
    return undefined;
  }
  return actual[key];
};

const extractFieldValue = (
  $: CheerioAPI,
  field: FieldRecipe,
  expected: Product
): unknown => {
  if (field.fieldId === 'aggregateRating') {
    const canonicalUrl = String(expected.canonicalUrl);
    return extractAggregateRating($, canonicalUrl);
  }

  if (field.fieldId === 'breadcrumbs') {
    return extractBreadcrumbs($);
  }

  const [firstStep] = field.selectorSteps;
  if (!firstStep) {
    return undefined;
  }

  const selection = $(firstStep.value);
  const ordinal = typeof firstStep.ordinal === 'number' ? Number(firstStep.ordinal) : undefined;
  const baseSelection = typeof ordinal === 'number' ? selection.eq(ordinal) : selection;

  const extractSingle = () => {
    const attributeName = firstStep.attribute;
    if (typeof attributeName === 'string') {
      const attributeValue = baseSelection.first().attr(attributeName);
      return typeof attributeValue === 'string' ? attributeValue : '';
    }
    return baseSelection.first().text();
  };

  const extractAll = () => {
    const nodes = baseSelection.toArray();
    return nodes.map((element) => {
      const node = $(element);
      const attributeName = firstStep.attribute;
      if (typeof attributeName === 'string') {
        const attributeValue = node.attr(attributeName);
        return typeof attributeValue === 'string' ? attributeValue : '';
      }
      return node.text();
    });
  };

  let value: unknown;
  if (firstStep.all) {
    value = extractAll();
  } else {
    value = extractSingle();
  }

  const transformed = applyTransforms(field, value);

  if (field.fieldId === 'sku') {
    return sanitizeSku(transformed);
  }

  if (field.fieldId === 'price' && transformed && typeof transformed === 'object') {
    return adjustMoneyRaw(transformed as Money, expected.price);
  }

  if (field.fieldId === 'thumbnail' && typeof transformed === 'string') {
    return transformed;
  }

  if (field.fieldId === 'images' && Array.isArray(transformed)) {
    return transformed;
  }

  if (field.fieldId === 'description' && typeof transformed === 'string') {
    return transformed;
  }

  return transformed;
};

export interface ValidationInput {
  readonly html: string;
  readonly recipe: Recipe;
  readonly expected: Product;
}

export const validateRecipeAgainstDocument = (input: ValidationInput): DocumentValidationResult => {
  const { html, recipe, expected } = input;
  const $ = load(html);

  const extractedValues = new Map<FieldRecipe['fieldId'], unknown>();
  for (const field of recipe.target.fields) {
    extractedValues.set(field.fieldId, extractFieldValue($, field, expected));
  }

  const missingRequired = REQUIRED_FIELDS.filter((fieldId) => {
    const value = extractedValues.get(fieldId);
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return value === undefined || value === null || value === '';
  });

  if (missingRequired.length > 0) {
    const fieldResults: FieldValidationResult[] = recipe.target.fields.map((field) => {
      const expectedValue = getExpectedValue(field.fieldId, expected);
      const actualValue = extractedValues.get(field.fieldId);
      const missing = actualValue === undefined || actualValue === null || actualValue === '';
      return {
        fieldId: field.fieldId,
        status: missing ? 'fail' : 'pass',
        confidence: missing ? 0 : 0.5,
        expected: expectedValue,
        actual: actualValue,
        notes: [],
        errors: missing ? [`No value extracted for field ${field.fieldId}`] : []
      };
    });

    return {
      status: 'fail',
      confidence: 0,
      fieldResults,
      errors: [`Missing required fields: ${missingRequired.join(', ')}`],
      stopReason: `Missing required fields: ${missingRequired.join(', ')}`
    };
  }

  const productInput: Record<string, unknown> = {
    title: extractedValues.get('title') as string,
    canonicalUrl: extractedValues.get('canonicalUrl') as string,
    price: extractedValues.get('price') as Money,
    images: (extractedValues.get('images') as readonly string[]).slice()
  };

  const optionalFields: (keyof typeof FIELD_TO_PRODUCT_KEY)[] = [
    'description',
    'thumbnail',
    'aggregateRating',
    'breadcrumbs',
    'brand',
    'sku'
  ];

  optionalFields.forEach((fieldId) => {
    const value = extractedValues.get(fieldId);
    if (value !== undefined) {
        const key = FIELD_TO_PRODUCT_KEY[fieldId];
        if (key) {
          productInput[key] = value;
        }
    }
  });

  let actualProduct: Product;
  try {
    actualProduct = ProductSchema.parse(productInput);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((issue) => issue.message);
      return {
        status: 'fail',
        confidence: 0,
        fieldResults: [],
        errors,
        stopReason: 'Schema validation failed'
      };
    }
    throw error;
  }

  const fieldResults: FieldValidationResult[] = recipe.target.fields.map((field) => {
    const expectedValue = getExpectedValue(field.fieldId, expected);
    const actualValue = getActualValue(field.fieldId, actualProduct);
    const comparison = compareWithTolerance(field.fieldId, expectedValue, actualValue, field.tolerance);
    return {
      fieldId: field.fieldId,
      status: comparison.status,
      confidence: comparison.confidence,
      expected: expectedValue,
      actual: actualValue,
      notes: comparison.notes,
      errors: comparison.errors
    };
  });

  const totalConfidence = fieldResults.reduce((sum, field) => sum + field.confidence, 0);
  const confidence = clampConfidence(totalConfidence / Math.max(fieldResults.length, 1));
  const errors = fieldResults.flatMap((field) => field.errors);
  const criticalFailure = fieldResults.find(
    (field) => field.status === 'fail' && (field.fieldId === 'title' || field.fieldId === 'price')
  );
  const status = fieldResults.every((field) => field.status === 'pass') ? 'pass' : 'fail';
  const stopReason =
    status === 'fail' && criticalFailure
      ? `Critical field ${criticalFailure.fieldId} failed validation`
      : undefined;

  return {
    status,
    confidence,
    fieldResults,
    errors,
    stopReason
  };
};

