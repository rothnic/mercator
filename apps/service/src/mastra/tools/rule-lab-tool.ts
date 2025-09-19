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

const inputSchema = z
  .object({
    action: z.enum(['list', 'set', 'remove', 'evaluate']),
    workspaceId: z.string(),
    rule: FieldRuleSchema.optional(),
    fieldId: RecipeFieldIdSchema.optional(),
    focus: z.array(RecipeFieldIdSchema).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    switch (value.action) {
      case 'list': {
        if (value.rule !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rule'],
            message: 'Remove the rule field when listing selectors.'
          });
        }
        if (value.fieldId !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fieldId'],
            message: 'Remove the fieldId when listing selectors.'
          });
        }
        if (value.focus !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['focus'],
            message: 'Remove the focus filter when listing selectors.'
          });
        }
        break;
      }
      case 'set': {
        if (value.rule === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rule'],
            message: 'Provide a rule definition when action is "set".'
          });
        }
        if (value.fieldId !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fieldId'],
            message: 'Remove the fieldId when updating rules.'
          });
        }
        if (value.focus !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['focus'],
            message: 'Remove the focus filter when updating rules.'
          });
        }
        break;
      }
      case 'remove': {
        if (value.fieldId === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fieldId'],
            message: 'Provide a fieldId to remove the matching rule.'
          });
        }
        if (value.rule !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rule'],
            message: 'Remove the rule payload when deleting a selector.'
          });
        }
        if (value.focus !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['focus'],
            message: 'Remove the focus filter when deleting a selector.'
          });
        }
        break;
      }
      case 'evaluate': {
        if (value.rule !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rule'],
            message: 'Remove the rule payload when evaluating selectors.'
          });
        }
        if (value.fieldId !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fieldId'],
            message: 'Remove the fieldId when evaluating selectors.'
          });
        }
        break;
      }
    }
  });

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
        const fieldId = RecipeFieldIdSchema.parse(context.fieldId);
        const rules = removeRule(context.workspaceId, fieldId);
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
