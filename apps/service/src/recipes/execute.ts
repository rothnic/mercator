import { load, type CheerioAPI } from 'cheerio';

import { ProductSchema, applyTransform, type Product, type Money } from '@mercator/core';
import type { FieldRecipe, Recipe } from '@mercator/core';

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

const sanitizeSku = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/^sku:\s*/i, '').trim();
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
  canonicalUrl?: string
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

  const aggregate: RatingLike = { ratingValue };

  if (Number.isFinite(reviewCount)) {
    aggregate.reviewCount = reviewCount;
  }

  if (Number.isFinite(bestRating)) {
    aggregate.bestRating = bestRating;
  }

  if (canonicalUrl) {
    aggregate.url = `${canonicalUrl}#reviews`;
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

const extractFieldValue = (
  $: CheerioAPI,
  field: FieldRecipe,
  context: Map<FieldRecipe['fieldId'], unknown>
): unknown => {
  if (field.fieldId === 'aggregateRating') {
    const canonical = typeof context.get('canonicalUrl') === 'string' ? (context.get('canonicalUrl') as string) : undefined;
    return extractAggregateRating($, canonical);
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

  return transformed;
};

const assignProductValue = (
  productInput: Record<string, unknown>,
  fieldId: FieldRecipe['fieldId'],
  value: unknown
) => {
  const key = FIELD_TO_PRODUCT_KEY[fieldId];
  if (!key || value === undefined) {
    return;
  }

  if (fieldId === 'images' && Array.isArray(value)) {
    productInput[key] = value.filter((entry): entry is string => typeof entry === 'string');
    return;
  }

  if (fieldId === 'price' && value && typeof value === 'object') {
    productInput[key] = value as Money;
    return;
  }

  productInput[key] = value;
};

export interface RecipeExecutionResult {
  readonly product: Product;
  readonly fieldValues: Map<FieldRecipe['fieldId'], unknown>;
}

export const executeRecipe = (html: string, recipe: Recipe): RecipeExecutionResult => {
  const $ = load(html);
  const values = new Map<FieldRecipe['fieldId'], unknown>();

  for (const field of recipe.target.fields) {
    const value = extractFieldValue($, field, values);
    values.set(field.fieldId, value);
  }

  const productInput: Record<string, unknown> = {};

  const required: FieldRecipe['fieldId'][] = ['title', 'canonicalUrl', 'price', 'images'];
  for (const fieldId of required) {
    const value = values.get(fieldId);
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      throw new Error(`Missing required field "${fieldId}" when executing recipe.`);
    }
    assignProductValue(productInput, fieldId, value);
  }

  const optional: FieldRecipe['fieldId'][] = [
    'description',
    'thumbnail',
    'aggregateRating',
    'breadcrumbs',
    'brand',
    'sku'
  ];

  for (const fieldId of optional) {
    const value = values.get(fieldId);
    if (value !== undefined) {
      assignProductValue(productInput, fieldId, value);
    }
  }

  const product = ProductSchema.parse(productInput);

  return {
    product,
    fieldValues: values
  };
};
