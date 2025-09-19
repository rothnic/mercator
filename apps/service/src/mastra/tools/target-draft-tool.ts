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

const replaceSchema = z.object({
  action: z.literal('replace'),
  workspaceId: z.string(),
  target: ProductSchema
});

const mergeSchema = z.object({
  action: z.literal('merge'),
  workspaceId: z.string(),
  target: ProductDraftSchema
});

const clearSchema = z.object({
  action: z.literal('clear'),
  workspaceId: z.string()
});

const getSchema = z.object({
  action: z.literal('get'),
  workspaceId: z.string()
});

const inputSchema = z.discriminatedUnion('action', [replaceSchema, mergeSchema, clearSchema, getSchema]);

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
        const snapshot = replaceTargetDraft(context.workspaceId, context.target);
        return Promise.resolve({
          workspaceId: snapshot.id,
          action: 'replace',
          targetDraft: snapshot.targetDraft,
          updatedAt: snapshot.updatedAt
        } satisfies z.infer<typeof outputSchema>);
      }
      case 'merge': {
        const snapshot = mergeTargetDraft(context.workspaceId, context.target);
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
