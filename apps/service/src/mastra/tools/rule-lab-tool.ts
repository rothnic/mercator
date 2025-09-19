import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { RecipeFieldIdSchema } from '@mercator/core/tolerances';
import {
  evaluateRules,
  FieldRuleSchema,
  listRules,
  removeRule,
  setRule,
  type RuleEvaluationResult
} from '../workspaces/document-workspace';

const listSchema = z.object({
  action: z.literal('list'),
  workspaceId: z.string()
});

const setSchema = z.object({
  action: z.literal('set'),
  workspaceId: z.string(),
  rule: FieldRuleSchema
});

const removeSchema = z.object({
  action: z.literal('remove'),
  workspaceId: z.string(),
  fieldId: RecipeFieldIdSchema
});

const evaluateSchema = z.object({
  action: z.literal('evaluate'),
  workspaceId: z.string(),
  focus: z.array(RecipeFieldIdSchema).optional()
});

const inputSchema = z.discriminatedUnion('action', [listSchema, setSchema, removeSchema, evaluateSchema]);

const ruleEvaluationSchema: z.ZodType<RuleEvaluationResult> = z.object({
  fieldId: RecipeFieldIdSchema,
  selector: z.string(),
  attribute: z.string().optional(),
  ordinal: z.number().int().min(0).optional(),
  all: z.boolean(),
  note: z.string().optional(),
  matches: z.number().int().nonnegative(),
  extracted: z.union([z.string(), z.array(z.string()), z.null()]),
  observedValues: z.array(z.string()),
  expected: z.any().optional(),
  status: z.enum(['match', 'mismatch', 'no-target', 'no-extraction', 'unsupported', 'error']),
  details: z.string().optional()
});

const listOutputSchema = z.object({
  action: z.literal('list'),
  workspaceId: z.string(),
  rules: z.array(FieldRuleSchema)
});

const setOutputSchema = z.object({
  action: z.literal('set'),
  workspaceId: z.string(),
  rules: z.array(FieldRuleSchema)
});

const removeOutputSchema = z.object({
  action: z.literal('remove'),
  workspaceId: z.string(),
  rules: z.array(FieldRuleSchema)
});

const evaluateOutputSchema = z.object({
  action: z.literal('evaluate'),
  workspaceId: z.string(),
  results: z.array(ruleEvaluationSchema)
});

const outputSchema = z.discriminatedUnion('action', [
  listOutputSchema,
  setOutputSchema,
  removeOutputSchema,
  evaluateOutputSchema
]);

export const ruleLabTool = createTool({
  id: 'rule-lab',
  description: 'Manage selector rules for the workspace and compare extraction results to the current target draft.',
  inputSchema,
  outputSchema,
  async execute({ context }) {
    switch (context.action) {
      case 'list': {
        const rules = listRules(context.workspaceId);
        return {
          action: 'list',
          workspaceId: context.workspaceId,
          rules
        } satisfies z.infer<typeof listOutputSchema>;
      }
      case 'set': {
        const rule = FieldRuleSchema.parse(context.rule);
        const rules = setRule(context.workspaceId, rule);
        return {
          action: 'set',
          workspaceId: context.workspaceId,
          rules
        } satisfies z.infer<typeof setOutputSchema>;
      }
      case 'remove': {
        const rules = removeRule(context.workspaceId, context.fieldId);
        return {
          action: 'remove',
          workspaceId: context.workspaceId,
          rules
        } satisfies z.infer<typeof removeOutputSchema>;
      }
      case 'evaluate': {
        const focus = context.focus ? [...context.focus] : undefined;
        const results = await evaluateRules(context.workspaceId, focus);
        return {
          action: 'evaluate',
          workspaceId: context.workspaceId,
          results
        } satisfies z.infer<typeof evaluateOutputSchema>;
      }
      default:
        throw new Error(`Unsupported action ${(context as { action: string }).action}`);
    }
  }
});
