import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { firecrawlService } from '../services/firecrawl-service';
import { findRecipesForDocument } from '../services/recipe-directory';
import {
  getWorkspaceForUrl,
  readOcrTranscript,
  registerDocumentWorkspace,
  type DocumentWorkspaceSnapshot,
} from '../workspaces/document-workspace';

const lifecycleStateSchema = z.enum(['draft', 'candidate', 'stable', 'retired']);

const recipeSummarySchema = z
  .object({
    id: z.string(),
    state: lifecycleStateSchema,
    name: z.string(),
    updatedAt: z.string(),
    promotedAt: z.string().optional(),
    document: z
      .object({
        domain: z.string(),
        path: z.string(),
      })
      .optional(),
    fieldCount: z.number().int().nonnegative(),
  })
  .readonly();

const directoryLookupSchema = z.object({
  stable: recipeSummarySchema.optional(),
  drafts: z.array(recipeSummarySchema).readonly(),
});

const MAX_OCR_LINES = 12;

const sanitizeTranscriptLine = (value: string): string =>
  value
    .replace(/^#+\s*/, '')
    .replace(/[*`_]+/g, '')
    .trim();

const deriveOcrTranscript = (markdown: string): readonly string[] => {
  return markdown
    .split(/\r?\n/)
    .map((line) => sanitizeTranscriptLine(line))
    .filter((line) => line.length > 0)
    .slice(0, MAX_OCR_LINES)
    .map((line) => line.slice(0, 120));
};

const outputSchema = z.object({
  workspaceId: z.string(),
  url: z.string().url(),
  domain: z.string(),
  path: z.string(),
  screenshotUrl: z.string().url().optional(),
  hasScreenshot: z.boolean(),
  ocrPreview: z.array(z.string()).max(5).optional(),
  htmlLength: z.number().int().nonnegative(),
  markdownLength: z.number().int().nonnegative(),
  ruleCount: z.number().int().nonnegative(),
  refreshed: z.boolean(),
  existingRules: directoryLookupSchema.optional(),
});

const inputSchema = z.object({
  url: z.string().url({ message: 'Provide a valid URL to scrape.' }),
  refresh: z.boolean().optional(),
});

export const scrapeUrlTool = createTool({
  id: 'scrape-url',
  description:
    'Fetches the target URL via Firecrawl, registers a document workspace, and surfaces any stored recipes for the domain/path.',
  inputSchema,
  outputSchema,
  async execute({ context }) {
    const { url, refresh } = context;
    const effectiveRefresh = refresh ?? false;
    let snapshot: DocumentWorkspaceSnapshot | undefined = effectiveRefresh
      ? undefined
      : getWorkspaceForUrl(url);
    let refreshed = false;
    let transcript: readonly string[] | undefined;

    if (!snapshot || effectiveRefresh) {
      const scrape = await firecrawlService.scrape(url);
      transcript = deriveOcrTranscript(scrape.markdown);
      snapshot = registerDocumentWorkspace({
        url: scrape.url,
        domain: scrape.domain,
        path: scrape.path,
        html: scrape.html,
        markdown: scrape.markdown,
        screenshotUrl: scrape.screenshotUrl,
        screenshotBase64: scrape.screenshotBase64,
        ocrTranscript: transcript,
      });
      refreshed = true;
    }

    const existing = await findRecipesForDocument(snapshot.domain, snapshot.path).catch(
      () => undefined,
    );

    if (!transcript) {
      transcript = await readOcrTranscript(snapshot.id)
        .then((result) => result.lines)
        .catch(() => []);
    }

    const ocrPreview = transcript.slice(0, 4);

    return {
      workspaceId: snapshot.id,
      url: snapshot.url,
      domain: snapshot.domain,
      path: snapshot.path,
      screenshotUrl: snapshot.screenshotUrl,
      hasScreenshot: Boolean(snapshot.screenshotBase64 || snapshot.screenshotUrl),
      ocrPreview: ocrPreview.length > 0 ? ocrPreview : undefined,
      htmlLength: snapshot.htmlLength,
      markdownLength: snapshot.markdownLength,
      ruleCount: snapshot.ruleCount,
      refreshed,
      existingRules: existing,
    } satisfies z.infer<typeof outputSchema>;
  },
});
