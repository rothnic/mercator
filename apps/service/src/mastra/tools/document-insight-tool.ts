import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  getWorkspaceSnapshot,
  queryHtml,
  searchMarkdown,
  ProductDraftSchema,
  type RuleEvaluationResult
} from '../workspaces/document-workspace';

const ruleEvaluationStatusSchema = z.enum(['match', 'mismatch', 'no-target', 'no-extraction', 'unsupported', 'error']);

const ruleEvaluationSchema: z.ZodType<RuleEvaluationResult> = z.object({
  fieldId: z.string(),
  selector: z.string(),
  attribute: z.string().optional(),
  ordinal: z.number().int().min(0).optional(),
  all: z.boolean(),
  note: z.string().optional(),
  matches: z.number().int().nonnegative(),
  extracted: z.union([z.string(), z.array(z.string()), z.null()]),
  observedValues: z.array(z.string()),
  expected: z.any().optional(),
  status: ruleEvaluationStatusSchema,
  details: z.string().optional()
});

const overviewOutputSchema = z.object({
  action: z.literal('overview'),
  workspace: z.object({
    id: z.string(),
    url: z.string().url(),
    domain: z.string(),
    path: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    htmlLength: z.number().int().nonnegative(),
    markdownLength: z.number().int().nonnegative(),
    ruleCount: z.number().int().nonnegative(),
    targetDraft: ProductDraftSchema.optional(),
    lastEvaluation: z.array(ruleEvaluationSchema).optional()
  })
});

const htmlQueryMatchSchema = z.object({
  html: z.string(),
  text: z.string(),
  attributes: z.record(z.string()),
  attributeValue: z.string().optional(),
  path: z.string()
});

const htmlQueryOutputSchema = z.object({
  action: z.literal('htmlQuery'),
  workspaceId: z.string(),
  selector: z.string(),
  attribute: z.string().optional(),
  totalMatches: z.number().int().nonnegative(),
  matches: z.array(htmlQueryMatchSchema),
  chunk: z
    .object({
      id: z.string(),
      selector: z.string(),
      label: z.string().optional(),
      description: z.string().optional(),
      snippet: z.string(),
      nodeCount: z.number().int().nonnegative()
    })
    .optional()
});

const markdownSearchMatchSchema = z.object({
  heading: z.string().nullable(),
  excerpt: z.string(),
  lineRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
});

const markdownSearchOutputSchema = z.object({
  action: z.literal('markdownSearch'),
  workspaceId: z.string(),
  query: z.string(),
  totalMatches: z.number().int().nonnegative(),
  matches: z.array(markdownSearchMatchSchema)
});

const inputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('overview'),
    workspaceId: z.string()
  }),
  z.object({
    action: z.literal('htmlQuery'),
    workspaceId: z.string(),
    selector: z.string().min(1, 'Provide a CSS selector to inspect.'),
    attribute: z.string().optional(),
    limit: z.number().int().positive().max(25).optional(),
    chunkId: z.string().optional()
  }),
  z.object({
    action: z.literal('markdownSearch'),
    workspaceId: z.string(),
    query: z.string().min(1, 'Provide a search phrase to locate within the markdown transcript.'),
    caseSensitive: z.boolean().optional(),
    maxSnippets: z.number().int().positive().max(10).optional()
  })
]);

const outputSchema = z.discriminatedUnion('action', [overviewOutputSchema, htmlQueryOutputSchema, markdownSearchOutputSchema]);

export const documentInsightTool = createTool({
  id: 'document-insight',
  description: 'Inspect the current document workspace, run HTML selector probes, or search the markdown transcript.',
  inputSchema,
  outputSchema,
  async execute({ context }) {
    switch (context.action) {
      case 'overview': {
        const snapshot = getWorkspaceSnapshot(context.workspaceId);
        return {
          action: 'overview',
          workspace: {
            id: snapshot.id,
            url: snapshot.url,
            domain: snapshot.domain,
            path: snapshot.path,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            htmlLength: snapshot.htmlLength,
            markdownLength: snapshot.markdownLength,
            ruleCount: snapshot.ruleCount,
            targetDraft: snapshot.targetDraft,
            lastEvaluation: snapshot.lastEvaluation
          }
        } satisfies z.infer<typeof overviewOutputSchema>;
      }
      case 'htmlQuery': {
        const result = await queryHtml(context.workspaceId, {
          selector: context.selector,
          attribute: context.attribute,
          limit: context.limit,
          chunkId: context.chunkId
        });
        return {
          action: 'htmlQuery',
          workspaceId: context.workspaceId,
          selector: context.selector,
          attribute: context.attribute,
          totalMatches: result.totalMatches,
          matches: result.matches.map((match) => ({
            html: match.html,
            text: match.text,
            attributes: { ...match.attributes },
            attributeValue: match.attributeValue,
            path: match.path
          })),
          chunk: result.chunk
            ? {
                id: result.chunk.id,
                selector: result.chunk.selector,
                label: result.chunk.label,
                description: result.chunk.description,
                snippet: result.chunk.snippet,
                nodeCount: result.chunk.nodeCount
              }
            : undefined
        } satisfies z.infer<typeof htmlQueryOutputSchema>;
      }
      case 'markdownSearch': {
        const result = await searchMarkdown(context.workspaceId, {
          query: context.query,
          caseSensitive: context.caseSensitive,
          maxSnippets: context.maxSnippets
        });
        return {
          action: 'markdownSearch',
          workspaceId: context.workspaceId,
          query: context.query,
          totalMatches: result.totalMatches,
          matches: result.matches.map((match) => ({
            heading: match.heading,
            excerpt: match.excerpt,
            lineRange: [match.lineRange[0], match.lineRange[1]] as [number, number]
          }))
        } satisfies z.infer<typeof markdownSearchOutputSchema>;
      }
      default:
        throw new Error(`Unsupported action ${(context as { action: string }).action}`);
    }
  }
});
