import type { DocumentSnapshot } from '../orchestrator/index.js';
import type { DocumentHtmlChunkDefinition } from '../orchestrator/rule-repository.js';
import { createConsoleLogger, type ServiceLogger, serializeError } from '../logger.js';

import type { FirecrawlClient, FirecrawlResult } from './firecrawl-client.js';

export type IngestionSource = 'firecrawl' | 'direct-fetch';

export interface IngestedDocument {
  readonly document: DocumentSnapshot;
  readonly ocrTranscript: readonly string[];
  readonly markdown?: string;
  readonly htmlChunks?: readonly DocumentHtmlChunkDefinition[];
  readonly source: IngestionSource;
}

export interface IngestDocumentOptions {
  readonly url: string;
  readonly firecrawlClient?: FirecrawlClient;
  readonly fetchFn?: typeof fetch;
  readonly logger?: ServiceLogger;
}

const normalizePath = (value: string): string => (value.startsWith('/') ? value : `/${value}`);

const toLines = (value: string | undefined): readonly string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const deriveTranscript = (result: FirecrawlResult | undefined): readonly string[] => {
  if (!result) {
    return [];
  }

  if (result.ocrTranscript && result.ocrTranscript.length > 0) {
    return [...result.ocrTranscript];
  }

  const textLines = toLines(result.text);
  if (textLines.length > 0) {
    return textLines;
  }

  return toLines(result.markdown);
};

const fetchHtml = async (url: URL, fetchFn: typeof fetch): Promise<string> => {
  const response = await fetchFn(url.toString(), {
    headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch document ${url.toString()}: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

export const ingestDocument = async (options: IngestDocumentOptions): Promise<IngestedDocument> => {
  const logger = options.logger ?? createConsoleLogger();
  let parsed: URL;

  try {
    parsed = new URL(options.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid document URL: ${message}`);
  }

  const fetchFn = options.fetchFn ?? fetch;
  let firecrawlResult: FirecrawlResult | undefined;

  if (options.firecrawlClient) {
    try {
      firecrawlResult = await options.firecrawlClient.fetchDocument(parsed.toString());
      logger.info('Fetched document via Firecrawl.', {
        url: parsed.toString(),
        hasMarkdown: Boolean(firecrawlResult.markdown),
        hasScreenshot: Boolean(firecrawlResult.screenshotBase64),
        transcriptLength: firecrawlResult.ocrTranscript?.length ?? 0
      });
    } catch (error) {
      logger.error('Firecrawl ingestion failed. Falling back to direct fetch.', {
        url: parsed.toString(),
        error: serializeError(error)
      });
      firecrawlResult = undefined;
    }
  }

  let html = firecrawlResult?.html;
  let source: IngestionSource = 'firecrawl';

  if (!html) {
    html = await fetchHtml(parsed, fetchFn);
    source = 'direct-fetch';
    logger.warn('Firecrawl did not return HTML. Retrieved document with direct fetch.', {
      url: parsed.toString()
    });
  }

  const transcript = deriveTranscript(firecrawlResult);
  if (firecrawlResult?.screenshotBase64 && transcript.length === 0) {
    logger.warn('Screenshot available but OCR transcript is empty.', {
      url: parsed.toString()
    });
  }

  const document: DocumentSnapshot = {
    domain: parsed.hostname,
    path: parsed.pathname ? normalizePath(parsed.pathname) : '/',
    html
  };

  return {
    document,
    ocrTranscript: transcript,
    markdown: firecrawlResult?.markdown,
    htmlChunks: firecrawlResult?.htmlChunks,
    source
  } satisfies IngestedDocument;
};
