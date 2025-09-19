import { randomUUID } from 'node:crypto';

import { createDocumentToolset, type FixtureToolset, type HtmlQueryResult, type MarkdownSearchResult } from '@mercator/agent-tools';
import { ProductSchema, type Product, RecipeFieldIdSchema, type RecipeFieldId } from '@mercator/core';
import { z } from 'zod';

export const ProductDraftSchema = ProductSchema.partial();

export type ProductDraft = z.infer<typeof ProductDraftSchema>;

export const FieldRuleSchema = z
  .object({
    fieldId: RecipeFieldIdSchema,
    selector: z.string().min(1, 'Selector must not be empty'),
    attribute: z.string().min(1).optional(),
    strategy: z.enum(['css']).default('css'),
    ordinal: z.number().int().min(0).optional(),
    all: z.boolean().default(false),
    note: z.string().optional()
  })
  .strict();

export type FieldRuleDefinition = z.infer<typeof FieldRuleSchema>;

export type RuleEvaluationStatus =
  | 'match'
  | 'mismatch'
  | 'no-target'
  | 'no-extraction'
  | 'unsupported'
  | 'error';

export interface RuleEvaluationResult {
  readonly fieldId: RecipeFieldId;
  readonly selector: string;
  readonly attribute?: string;
  readonly ordinal?: number;
  readonly all: boolean;
  readonly note?: string;
  readonly matches: number;
  readonly extracted: string | readonly string[] | null;
  readonly observedValues: readonly string[];
  readonly expected?: unknown;
  readonly status: RuleEvaluationStatus;
  readonly details?: string;
}

interface DocumentWorkspaceInternal {
  readonly id: string;
  readonly url: string;
  readonly domain: string;
  readonly path: string;
  readonly html: string;
  readonly markdown: string;
  readonly createdAt: Date;
  updatedAt: Date;
  screenshotUrl?: string;
  screenshotBase64?: string;
  targetDraft?: ProductDraft;
  readonly toolset: FixtureToolset;
  readonly rules: Map<RecipeFieldId, FieldRuleDefinition>;
  lastEvaluation?: readonly RuleEvaluationResult[];
}

export interface RegisterDocumentOptions {
  readonly url: string;
  readonly domain: string;
  readonly path: string;
  readonly html: string;
  readonly markdown: string;
  readonly screenshotUrl?: string;
  readonly screenshotBase64?: string;
}

export interface DocumentWorkspaceSnapshot {
  readonly id: string;
  readonly url: string;
  readonly domain: string;
  readonly path: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly screenshotUrl?: string;
  readonly screenshotBase64?: string;
  readonly htmlLength: number;
  readonly markdownLength: number;
  readonly targetDraft?: ProductDraft;
  readonly ruleCount: number;
  readonly lastEvaluation?: readonly RuleEvaluationResult[];
}

const workspaces = new Map<string, DocumentWorkspaceInternal>();

const assertWorkspace = (workspaceId: string): DocumentWorkspaceInternal => {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw new Error(`Document workspace ${workspaceId} does not exist.`);
  }
  return workspace;
};

const cloneRuleDefinition = (rule: FieldRuleDefinition): FieldRuleDefinition => ({
  fieldId: rule.fieldId,
  selector: rule.selector,
  attribute: rule.attribute,
  strategy: rule.strategy,
  ordinal: rule.ordinal,
  all: rule.all,
  note: rule.note
});

const cloneProductDraft = (draft: ProductDraft | undefined): ProductDraft | undefined => {
  if (!draft) {
    return undefined;
  }
  return structuredClone(draft);
};

const toSnapshot = (workspace: DocumentWorkspaceInternal): DocumentWorkspaceSnapshot => ({
  id: workspace.id,
  url: workspace.url,
  domain: workspace.domain,
  path: workspace.path,
  createdAt: workspace.createdAt.toISOString(),
  updatedAt: workspace.updatedAt.toISOString(),
  screenshotUrl: workspace.screenshotUrl,
  screenshotBase64: workspace.screenshotBase64,
  htmlLength: workspace.html.length,
  markdownLength: workspace.markdown.length,
  targetDraft: cloneProductDraft(workspace.targetDraft),
  ruleCount: workspace.rules.size,
  lastEvaluation: workspace.lastEvaluation ? workspace.lastEvaluation.map((entry) => ({ ...entry })) : undefined
});

const mergeObjects = (
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> => {
  const base = current ? structuredClone(current) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      base[key] = structuredClone(value);
      continue;
    }
    if (value && typeof value === 'object') {
      const existing = base[key];
      const next = mergeObjects(
        existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : undefined,
        value as Record<string, unknown>
      );
      base[key] = next;
      continue;
    }
    base[key] = value;
  }
  return base;
};

const readTargetField = (target: ProductDraft | undefined, fieldId: RecipeFieldId): unknown => {
  if (!target) {
    return undefined;
  }
  switch (fieldId) {
    case 'id':
      return target.id;
    case 'title':
      return target.title;
    case 'canonicalUrl':
      return target.canonicalUrl;
    case 'description':
      return target.description;
    case 'price':
      return target.price;
    case 'images':
      return target.images;
    case 'thumbnail':
      return target.thumbnail;
    case 'aggregateRating':
      return target.aggregateRating;
    case 'breadcrumbs':
      return target.breadcrumbs;
    case 'brand':
      return target.brand;
    case 'sku':
      return target.sku;
    default:
      return undefined;
  }
};

const normalizeForComparison = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForComparison(entry));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => [key, normalizeForComparison(entryValue)] as const);
    return Object.fromEntries(entries);
  }
  return value;
};

const isDeepEqual = (left: unknown, right: unknown): boolean => {
  return JSON.stringify(left) === JSON.stringify(right);
};

export const registerDocumentWorkspace = (options: RegisterDocumentOptions): DocumentWorkspaceSnapshot => {
  const { url, domain, path, html, markdown, screenshotUrl, screenshotBase64 } = options;
  const id = randomUUID();
  const createdAt = new Date();
  const toolset = createDocumentToolset({
    documentId: id,
    html,
    markdown
  });
  const workspace: DocumentWorkspaceInternal = {
    id,
    url,
    domain,
    path,
    html,
    markdown,
    createdAt,
    updatedAt: createdAt,
    screenshotUrl,
    screenshotBase64,
    toolset,
    rules: new Map()
  };
  workspaces.set(id, workspace);
  return toSnapshot(workspace);
};

export const getWorkspaceSnapshot = (workspaceId: string): DocumentWorkspaceSnapshot => {
  return toSnapshot(assertWorkspace(workspaceId));
};

export const listWorkspaceIds = (): readonly string[] => {
  return Array.from(workspaces.keys());
};

export const replaceTargetDraft = (workspaceId: string, target: Product): DocumentWorkspaceSnapshot => {
  const workspace = assertWorkspace(workspaceId);
  workspace.targetDraft = ProductSchema.parse(target);
  workspace.updatedAt = new Date();
  return toSnapshot(workspace);
};

export const mergeTargetDraft = (workspaceId: string, patch: ProductDraft): DocumentWorkspaceSnapshot => {
  const workspace = assertWorkspace(workspaceId);
  const validated = ProductDraftSchema.parse(patch);
  const current = workspace.targetDraft ? structuredClone(workspace.targetDraft) : undefined;
  const merged = ((): ProductDraft => {
    if (!current) {
      return validated;
    }
    const next = mergeObjects(
      current as Record<string, unknown>,
      validated as unknown as Record<string, unknown>
    );
    return next as ProductDraft;
  })();
  workspace.targetDraft = merged;
  workspace.updatedAt = new Date();
  return toSnapshot(workspace);
};

export const clearTargetDraft = (workspaceId: string): DocumentWorkspaceSnapshot => {
  const workspace = assertWorkspace(workspaceId);
  workspace.targetDraft = undefined;
  workspace.updatedAt = new Date();
  return toSnapshot(workspace);
};

export const listRules = (workspaceId: string): readonly FieldRuleDefinition[] => {
  const workspace = assertWorkspace(workspaceId);
  return Array.from(workspace.rules.values()).map(cloneRuleDefinition);
};

export const setRule = (workspaceId: string, rule: FieldRuleDefinition): readonly FieldRuleDefinition[] => {
  const workspace = assertWorkspace(workspaceId);
  const validated = FieldRuleSchema.parse(rule);
  workspace.rules.set(validated.fieldId, cloneRuleDefinition(validated));
  workspace.updatedAt = new Date();
  return listRules(workspaceId);
};

export const removeRule = (workspaceId: string, fieldId: RecipeFieldId): readonly FieldRuleDefinition[] => {
  const workspace = assertWorkspace(workspaceId);
  workspace.rules.delete(fieldId);
  workspace.updatedAt = new Date();
  return listRules(workspaceId);
};

export const queryHtml = (
  workspaceId: string,
  request: { selector: string; attribute?: string; limit?: number; chunkId?: string }
): Promise<HtmlQueryResult> => {
  const workspace = assertWorkspace(workspaceId);
  return workspace.toolset.html.query({
    selector: request.selector,
    attribute: request.attribute,
    limit: request.limit,
    chunkId: request.chunkId
  });
};

export const searchMarkdown = (
  workspaceId: string,
  request: { query: string; caseSensitive?: boolean; maxSnippets?: number }
): Promise<MarkdownSearchResult> => {
  const workspace = assertWorkspace(workspaceId);
  return workspace.toolset.markdown.search({
    query: request.query,
    caseSensitive: request.caseSensitive,
    maxSnippets: request.maxSnippets
  });
};

export const evaluateRules = async (workspaceId: string, focus?: readonly RecipeFieldId[]): Promise<readonly RuleEvaluationResult[]> => {
  const workspace = assertWorkspace(workspaceId);
  const fieldIds = focus && focus.length > 0 ? focus : Array.from(workspace.rules.keys());
  const evaluations: RuleEvaluationResult[] = [];

  for (const fieldId of fieldIds) {
    const rule = workspace.rules.get(fieldId);
    if (!rule) {
      continue;
    }
    if (rule.strategy !== 'css') {
      evaluations.push({
        fieldId,
        selector: rule.selector,
        attribute: rule.attribute,
        ordinal: rule.ordinal,
        all: rule.all,
        note: rule.note,
        matches: 0,
        extracted: null,
        observedValues: [],
        expected: readTargetField(workspace.targetDraft, fieldId),
        status: 'unsupported',
        details: 'Only CSS selectors are currently supported.'
      });
      continue;
    }

    try {
      const ordinalIndex = typeof rule.ordinal === 'number' && Number.isFinite(rule.ordinal) ? rule.ordinal : 0;
      const limit = rule.all ? Math.max(10, ordinalIndex + 1) : ordinalIndex + 1;
      const queryResult = await workspace.toolset.html.query({
        selector: rule.selector,
        attribute: rule.attribute,
        limit
      });
      const observedValues = queryResult.matches.map((match) => {
        if (rule.attribute) {
          return match.attributeValue ?? '';
        }
        return match.text;
      });

      let extracted: string | readonly string[] | null = null;
      if (rule.all) {
        extracted = observedValues;
      } else {
        const index = rule.ordinal ?? 0;
        extracted = observedValues[index] ?? null;
      }

      const expected = readTargetField(workspace.targetDraft, fieldId);
      const normalizedExpected = normalizeForComparison(expected);
      const normalizedExtracted = normalizeForComparison(extracted);
      let status: RuleEvaluationStatus;
      if (observedValues.length === 0 || extracted === null) {
        status = 'no-extraction';
      } else if (normalizedExpected === undefined) {
        status = 'no-target';
      } else if (isDeepEqual(normalizedExpected, normalizedExtracted)) {
        status = 'match';
      } else {
        status = 'mismatch';
      }

      evaluations.push({
        fieldId,
        selector: rule.selector,
        attribute: rule.attribute,
        ordinal: rule.ordinal,
        all: rule.all,
        note: rule.note,
        matches: queryResult.totalMatches,
        extracted,
        observedValues,
        expected,
        status,
        details:
          status === 'mismatch'
            ? 'Extracted value does not match the current target draft.'
            : status === 'no-target'
            ? 'No target value is available for comparison.'
            : status === 'no-extraction'
            ? 'Selector did not return any matches.'
            : undefined
      });
    } catch (error) {
      const expected = readTargetField(workspace.targetDraft, fieldId);
      evaluations.push({
        fieldId,
        selector: rule.selector,
        attribute: rule.attribute,
        ordinal: rule.ordinal,
        all: rule.all,
        note: rule.note,
        matches: 0,
        extracted: null,
        observedValues: [],
        expected,
        status: 'error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  workspace.lastEvaluation = evaluations.map((entry) => ({ ...entry }));
  workspace.updatedAt = new Date();
  return evaluations;
};

export const getTargetDraft = (workspaceId: string): ProductDraft | undefined => {
  const workspace = assertWorkspace(workspaceId);
  return cloneProductDraft(workspace.targetDraft);
};

export const getWorkspaceForUrl = (url: string): DocumentWorkspaceSnapshot | undefined => {
  try {
    const parsed = new URL(url);
    const entry = Array.from(workspaces.values()).find(
      (workspace) => workspace.domain === parsed.hostname && workspace.path === parsed.pathname
    );
    return entry ? toSnapshot(entry) : undefined;
  } catch {
    return undefined;
  }
};
