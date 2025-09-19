import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { firecrawlService } from '../services/firecrawl-service';
import { findRecipesForDocument } from '../services/recipe-directory';
import {
  getWorkspaceForUrl,
  registerDocumentWorkspace,
  type DocumentWorkspaceSnapshot
} from '../workspaces/document-workspace';

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

const directoryLookupSchema = z.object({
  stable: recipeSummarySchema.optional(),
  drafts: z.array(recipeSummarySchema)
});

const outputSchema = z.object({
  workspaceId: z.string(),
  url: z.string().url(),
  domain: z.string(),
  path: z.string(),
  screenshotUrl: z.string().url().optional(),
  screenshotBase64: z.string().optional(),
  htmlLength: z.number().int().nonnegative(),
  markdownLength: z.number().int().nonnegative(),
  ruleCount: z.number().int().nonnegative(),
  refreshed: z.boolean(),
  existingRules: directoryLookupSchema.optional()
});

const inputSchema = z.object({
  url: z.string().url({ message: 'Provide a valid URL to scrape.' }),
  refresh: z.boolean().optional().default(false)
});

export const scrapeUrlTool = createTool({
  id: 'scrape-url',
  description:
    'Fetches the target URL via Firecrawl, registers a document workspace, and surfaces any stored recipes for the domain/path.',
  inputSchema,
  outputSchema,
  async execute({ context }) {
    const { url, refresh } = context;
    let snapshot: DocumentWorkspaceSnapshot | undefined = refresh ? undefined : getWorkspaceForUrl(url);
    let refreshed = false;

    if (!snapshot || refresh) {
      const scrape = await firecrawlService.scrape(url);
      snapshot = registerDocumentWorkspace({
        url: scrape.url,
        domain: scrape.domain,
        path: scrape.path,
        html: scrape.html,
        markdown: scrape.markdown,
        screenshotUrl: scrape.screenshotUrl,
        screenshotBase64: scrape.screenshotBase64
      });
      refreshed = true;
    }

    const existing = await findRecipesForDocument(snapshot.domain, snapshot.path).catch(() => undefined);

    return {
      workspaceId: snapshot.id,
      url: snapshot.url,
      domain: snapshot.domain,
      path: snapshot.path,
      screenshotUrl: snapshot.screenshotUrl,
      screenshotBase64: snapshot.screenshotBase64,
      htmlLength: snapshot.htmlLength,
      markdownLength: snapshot.markdownLength,
      ruleCount: snapshot.ruleCount,
      refreshed,
      existingRules: existing
    } satisfies z.infer<typeof outputSchema>;
  }
});
