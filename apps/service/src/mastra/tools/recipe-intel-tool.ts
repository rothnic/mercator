import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { findRecipesForDocument, findRecipesForUrl } from '../services/recipe-directory';
import { getWorkspaceSnapshot } from '../workspaces/document-workspace';

const lifecycleStateSchema = z.enum(['draft', 'candidate', 'stable', 'retired']);

const recipeSummarySchema = z.object({
  id: z.string(),
  state: lifecycleStateSchema,
  name: z.string(),
  updatedAt: z.string(),
  promotedAt: z.string().optional(),
  document: z
    .object({
      domain: z.string(),
      path: z.string()
    })
    .optional(),
  fieldCount: z.number().int().nonnegative()
});

const directorySchema = z.object({
  stable: recipeSummarySchema.optional(),
  drafts: z.array(recipeSummarySchema)
});

const inputSchema = z.object({
  workspaceId: z.string().optional(),
  url: z.string().url().optional()
});

const outputSchema = z.object({
  document: z
    .object({
      domain: z.string(),
      path: z.string()
    })
    .optional(),
  lookup: directorySchema.optional()
});

export const recipeIntelTool = createTool({
  id: 'recipe-intel',
  description: 'Returns stored recipes (draft or stable) for the given URL or active workspace domain/path.',
  inputSchema,
  outputSchema,
  async execute({ context }) {
    const hasWorkspace = typeof context.workspaceId === 'string' && context.workspaceId.trim().length > 0;
    const hasUrl = typeof context.url === 'string' && context.url.trim().length > 0;

    if (!hasWorkspace && !hasUrl) {
      throw new Error('Provide either a workspaceId or a URL to look up stored recipes.');
    }

    if (hasWorkspace) {
      const snapshot = getWorkspaceSnapshot(context.workspaceId!);
      const lookup = await findRecipesForDocument(snapshot.domain, snapshot.path);
      return {
        document: { domain: snapshot.domain, path: snapshot.path },
        lookup
      } satisfies z.infer<typeof outputSchema>;
    }

    const parsed = new URL(context.url!);
    const lookup = await findRecipesForUrl(parsed.toString());
    return {
      document: lookup ? { domain: parsed.hostname, path: parsed.pathname || '/' } : undefined,
      lookup: lookup ?? undefined
    } satisfies z.infer<typeof outputSchema>;
  }
});
