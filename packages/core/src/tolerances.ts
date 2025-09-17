import { z } from 'zod';

export const RecipeFieldIdSchema = z.enum([
  'id',
  'title',
  'canonicalUrl',
  'description',
  'price',
  'images',
  'thumbnail',
  'aggregateRating',
  'breadcrumbs',
  'brand',
  'sku'
]);

export type RecipeFieldId = z.infer<typeof RecipeFieldIdSchema>;

const TextToleranceSchema = z
  .object({
    kind: z.literal('text'),
    trim: z.boolean().default(true),
    caseSensitive: z.boolean().default(false),
    maxDistanceRatio: z.number().min(0).max(1).default(0)
  })
  .strict();

const MoneyToleranceSchema = z
  .object({
    kind: z.literal('money'),
    maxAbsoluteMinorUnits: z.number().int().min(0).default(0),
    maxRelativeDifference: z.number().min(0).max(1).default(0)
  })
  .strict();

const UrlToleranceSchema = z
  .object({
    kind: z.literal('url'),
    normalizeTrailingSlash: z.boolean().default(true),
    ignoreQuery: z.boolean().default(false)
  })
  .strict();

const ImageToleranceSchema = z
  .object({
    kind: z.literal('image'),
    ignoreQuery: z.boolean().default(true)
  })
  .strict();

const RatingToleranceSchema = z
  .object({
    kind: z.literal('rating'),
    maxDelta: z.number().min(0).max(5).default(0.25)
  })
  .strict();

const BreadcrumbToleranceSchema = z
  .object({
    kind: z.literal('breadcrumbs'),
    allowReordering: z.boolean().default(false),
    maxMissing: z.number().int().min(0).default(0)
  })
  .strict();

export const RecipeToleranceSchema = z.discriminatedUnion('kind', [
  TextToleranceSchema,
  MoneyToleranceSchema,
  UrlToleranceSchema,
  ImageToleranceSchema,
  RatingToleranceSchema,
  BreadcrumbToleranceSchema
]);

export type RecipeTolerance = z.infer<typeof RecipeToleranceSchema>;

type ToleranceByField = Record<RecipeFieldId, RecipeTolerance>;

const DEFAULT_TOLERANCES: ToleranceByField = {
  id: TextToleranceSchema.parse({ kind: 'text', caseSensitive: true }),
  title: TextToleranceSchema.parse({ kind: 'text', maxDistanceRatio: 0 }),
  canonicalUrl: UrlToleranceSchema.parse({ kind: 'url' }),
  description: TextToleranceSchema.parse({ kind: 'text', maxDistanceRatio: 0.1 }),
  price: MoneyToleranceSchema.parse({
    kind: 'money',
    maxAbsoluteMinorUnits: 1,
    maxRelativeDifference: 0
  }),
  images: ImageToleranceSchema.parse({ kind: 'image' }),
  thumbnail: ImageToleranceSchema.parse({ kind: 'image' }),
  aggregateRating: RatingToleranceSchema.parse({ kind: 'rating', maxDelta: 0.1 }),
  breadcrumbs: BreadcrumbToleranceSchema.parse({ kind: 'breadcrumbs' }),
  brand: TextToleranceSchema.parse({ kind: 'text', maxDistanceRatio: 0.05 }),
  sku: TextToleranceSchema.parse({ kind: 'text', caseSensitive: true })
};

export function getDefaultTolerance(fieldId: RecipeFieldId): RecipeTolerance {
  const value = DEFAULT_TOLERANCES[fieldId];

  if (!value) {
    throw new Error(`No default tolerance registered for field "${fieldId}"`);
  }

  return structuredClone(value);
}

export function listDefaultTolerances(): readonly (readonly [RecipeFieldId, RecipeTolerance])[] {
  const entries = Object.entries(DEFAULT_TOLERANCES).map(([field, tolerance]) => [
    field as RecipeFieldId,
    structuredClone(tolerance)
  ] satisfies [RecipeFieldId, RecipeTolerance]);

  return entries;
}

