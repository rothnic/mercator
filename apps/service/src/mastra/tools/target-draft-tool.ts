import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { ProductSchema } from '@mercator/core';
import {
  clearTargetDraft,
  getTargetDraft,
  mergeTargetDraft,
  ProductDraftSchema,
  replaceTargetDraft
} from '../workspaces/document-workspace';

const inputSchema = z
  .object({
    action: z.enum(['replace', 'merge', 'clear', 'get']),
    workspaceId: z.string(),
    target: z.unknown().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    switch (value.action) {
      case 'replace': {
        if (value.target === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['target'],
            message: 'Provide a full Product object when replacing the target draft.'
          });
          return;
        }
        const parsed = ProductSchema.safeParse(value.target);
        if (!parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['target'],
            message: 'The provided target does not match the Product schema.'
          });
        }
        break;
      }
      case 'merge': {
        if (value.target === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['target'],
            message: 'Provide a partial Product draft when merging into the target draft.'
          });
          return;
        }
        const parsed = ProductDraftSchema.safeParse(value.target);
        if (!parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['target'],
            message: 'The provided target does not match the Product draft schema.'
          });
        }
        break;
      }
      case 'clear':
      case 'get': {
        if (value.target !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['target'],
            message: `Remove the target field when action is "${value.action}".`
          });
        }
        break;
      }
    }
  });

const outputSchema = z.object({
  workspaceId: z.string(),
  action: z.enum(['replace', 'merge', 'clear', 'get']),
  targetDraft: ProductDraftSchema.optional(),
  updatedAt: z.string()
});

export const targetDraftTool = createTool({
  id: 'target-draft',
  description: 'Replace, merge, clear, or fetch the target product draft associated with the workspace.',
  inputSchema,
  outputSchema,
  execute({ context }) {
    switch (context.action) {
      case 'replace': {
        const product = ProductSchema.parse(context.target);
        const snapshot = replaceTargetDraft(context.workspaceId, product);
        return Promise.resolve({
          workspaceId: snapshot.id,
          action: 'replace',
          targetDraft: snapshot.targetDraft,
          updatedAt: snapshot.updatedAt
        } satisfies z.infer<typeof outputSchema>);
      }
      case 'merge': {
        const draftPatch = ProductDraftSchema.parse(context.target);
        const snapshot = mergeTargetDraft(context.workspaceId, draftPatch);
        return Promise.resolve({
          workspaceId: snapshot.id,
          action: 'merge',
          targetDraft: snapshot.targetDraft,
          updatedAt: snapshot.updatedAt
        } satisfies z.infer<typeof outputSchema>);
      }
      case 'clear': {
        const snapshot = clearTargetDraft(context.workspaceId);
        return Promise.resolve({
          workspaceId: snapshot.id,
          action: 'clear',
          targetDraft: snapshot.targetDraft,
          updatedAt: snapshot.updatedAt
        } satisfies z.infer<typeof outputSchema>);
      }
      case 'get': {
        const draft = getTargetDraft(context.workspaceId);
        return Promise.resolve({
          workspaceId: context.workspaceId,
          action: 'get',
          targetDraft: draft,
          updatedAt: new Date().toISOString()
        } satisfies z.infer<typeof outputSchema>);
      }
      default:
        throw new Error(`Unsupported action ${(context as { action: string }).action}`);
    }
  }
});
