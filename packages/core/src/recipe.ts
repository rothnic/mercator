import { z } from 'zod';

import { ProductSchema } from './schemas.js';
import {
  RecipeFieldIdSchema,
  RecipeToleranceSchema,
  type RecipeFieldId,
  type RecipeTolerance
} from './tolerances.js';
import { TransformInvocationSchema, type TransformInvocation } from './transforms.js';

const SelectorStrategySchema = z.enum(['css', 'xpath']);

const PlaywrightDirectiveSchema = z
  .object({
    action: z.enum(['goto', 'click', 'fill', 'waitForSelector', 'evaluate']).optional(),
    selector: z.string().min(1).optional(),
    value: z.string().optional(),
    description: z.string().optional()
  })
  .strict()
  .optional();

const SelectorStepSchema = z
  .object({
    strategy: SelectorStrategySchema.default('css'),
    value: z.string().min(1, 'Selector value must not be empty'),
    attribute: z.string().min(1).optional(),
    ordinal: z.number().int().min(0).optional(),
    all: z.boolean().default(false),
    note: z.string().optional(),
    playwright: PlaywrightDirectiveSchema
  })
  .strict();

const ValidatorSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('required')
    })
    .strict(),
  z
    .object({
      type: z.literal('regex'),
      pattern: z.string().min(1),
      flags: z.string().regex(/^[gimsuy]*$/).optional()
    })
    .strict(),
  z
    .object({
      type: z.literal('minLength'),
      value: z.number().int().min(0)
    })
    .strict()
]);

export type RecipeValidator = z.infer<typeof ValidatorSchema>;

const FieldMetricsSchema = z
  .object({
    sampleCount: z.number().int().min(0).default(0),
    passCount: z.number().int().min(0).default(0),
    failCount: z.number().int().min(0).default(0),
    lastRunAt: z.coerce.date().optional()
  })
  .strict();

export type FieldMetrics = z.infer<typeof FieldMetricsSchema>;

const FieldRecipeSchema = z
  .object({
    fieldId: RecipeFieldIdSchema,
    description: z.string().optional(),
    selectorSteps: z.array(SelectorStepSchema).min(1),
    transforms: z.array(TransformInvocationSchema).default([]),
    tolerance: RecipeToleranceSchema,
    validators: z.array(ValidatorSchema).default([]),
    metrics: FieldMetricsSchema.default({ sampleCount: 0, passCount: 0, failCount: 0 }),
    sample: z.unknown().optional()
  })
  .strict();

export type FieldRecipe = z.infer<typeof FieldRecipeSchema>;

const LifecycleStateSchema = z.enum(['draft', 'candidate', 'stable', 'retired']);

export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

const LifecycleEventSchema = z
  .object({
    state: LifecycleStateSchema,
    at: z.coerce.date(),
    actor: z.string().optional(),
    notes: z.string().optional()
  })
  .strict();

export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

const RecipeLifecycleSchema = z
  .object({
    state: LifecycleStateSchema,
    since: z.coerce.date(),
    history: z.array(LifecycleEventSchema).default([])
  })
  .strict();

export type RecipeLifecycle = z.infer<typeof RecipeLifecycleSchema>;

const RecipeMetricsSchema = z
  .object({
    totalRuns: z.number().int().min(0).default(0),
    successfulRuns: z.number().int().min(0).default(0),
    averageDurationMs: z.number().nonnegative().optional(),
    lastRunAt: z.coerce.date().optional()
  })
  .strict();

export type RecipeMetrics = z.infer<typeof RecipeMetricsSchema>;

const ProvenanceRecordSchema = z
  .object({
    fieldId: RecipeFieldIdSchema,
    evidence: z.string().min(1),
    confidence: z.number().min(0).max(1),
    notes: z.string().optional()
  })
  .strict();

export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

const RecipeTargetSchema = z
  .object({
    documentType: z.literal('product'),
    schema: ProductSchema,
    fields: z.array(FieldRecipeSchema).min(1)
  })
  .strict();

export type RecipeTarget = z.infer<typeof RecipeTargetSchema>;

export const RecipeSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    target: RecipeTargetSchema,
    lifecycle: RecipeLifecycleSchema,
    metrics: RecipeMetricsSchema.default({ totalRuns: 0, successfulRuns: 0 }),
    provenance: z.array(ProvenanceRecordSchema).default([])
  })
  .strict();

export type Recipe = z.infer<typeof RecipeSchema>;

export function hasField(recipe: Recipe, field: RecipeFieldId): boolean {
  return recipe.target.fields.some((entry) => entry.fieldId === field);
}

export type { RecipeFieldId, RecipeTolerance, TransformInvocation };

