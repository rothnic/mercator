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

interface DocumentInsightInputCandidate {
  action: 'overview' | 'htmlQuery' | 'markdownSearch';
  workspaceId: string;
  selector?: string;
  attribute?: string;
  limit?: number;
  chunkId?: string;
  query?: string;
  caseSensitive?: boolean;
  maxSnippets?: number;
}

const disallowKeys = (
  value: DocumentInsightInputCandidate,
  ctx: z.RefinementCtx,
  keys: (keyof DocumentInsightInputCandidate)[],
  action: DocumentInsightInputCandidate['action']
) => {
  for (const key of keys) {
    if (value[key] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `Remove this field when action is "${action}".`
      });
    }
  }
};

const inputSchema = z
  .object({
    action: z.enum(['overview', 'htmlQuery', 'markdownSearch']),
    workspaceId: z.string(),
    selector: z.string().optional(),
    attribute: z.string().optional(),
    limit: z.number().int().positive().max(25).optional(),
    chunkId: z.string().optional(),
    query: z.string().optional(),
    caseSensitive: z.boolean().optional(),
    maxSnippets: z.number().int().positive().max(10).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    switch (value.action) {
      case 'overview': {
        disallowKeys(
          value,
          ctx,
          ['selector', 'attribute', 'limit', 'chunkId', 'query', 'caseSensitive', 'maxSnippets'],
          'overview'
        );
        break;
      }
      case 'htmlQuery': {
        if (!value.selector || value.selector.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['selector'],
            message: 'Provide a CSS selector to inspect.'
          });
        }
        disallowKeys(value, ctx, ['query', 'caseSensitive', 'maxSnippets'], 'htmlQuery');
        break;
      }
      case 'markdownSearch': {
        if (!value.query || value.query.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['query'],
            message: 'Provide a search phrase to locate within the markdown transcript.'
          });
        }
        disallowKeys(value, ctx, ['selector', 'attribute', 'limit', 'chunkId'], 'markdownSearch');
        break;
      }
    }
  });

type DocumentInsightInput = DocumentInsightInputCandidate;

type DocumentInsightOverviewContext = Extract<DocumentInsightInput, { action: 'overview' }>;
type DocumentInsightHtmlQueryContext = Extract<DocumentInsightInput, { action: 'htmlQuery' }>;
type DocumentInsightMarkdownSearchContext = Extract<DocumentInsightInput, { action: 'markdownSearch' }>;

const isOverviewContext = (
  context: DocumentInsightInput
): context is DocumentInsightOverviewContext => context.action === 'overview';

const isHtmlQueryContext = (
  context: DocumentInsightInput
): context is DocumentInsightHtmlQueryContext =>
  context.action === 'htmlQuery' && typeof context.selector === 'string';

const isMarkdownSearchContext = (
  context: DocumentInsightInput
): context is DocumentInsightMarkdownSearchContext =>
  context.action === 'markdownSearch' && typeof context.query === 'string';

const outputSchema = z.discriminatedUnion('action', [overviewOutputSchema, htmlQueryOutputSchema, markdownSearchOutputSchema]);

export const documentInsightTool = createTool({
  id: 'document-insight',
  description: 'Inspect the current document workspace, run HTML selector probes, or search the markdown transcript.',
  inputSchema,
  outputSchema,
  async execute({ context }: { context: DocumentInsightInput }) {
    if (typeof context.workspaceId !== 'string' || context.workspaceId.trim().length === 0) {
      throw new Error('workspaceId must be a non-empty string.');
    }

    const workspaceId = context.workspaceId;

    if (isOverviewContext(context)) {
      const snapshot = getWorkspaceSnapshot(workspaceId);
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

    if (isHtmlQueryContext(context)) {
      const result = await queryHtml(workspaceId, {
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

    if (isMarkdownSearchContext(context)) {
      const result = await searchMarkdown(workspaceId, {
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

    throw new Error(`Unsupported action ${(context as { action: string }).action}`);
  }
});
