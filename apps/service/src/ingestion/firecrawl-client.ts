import { z } from 'zod';

import type { DocumentHtmlChunkDefinition } from '../orchestrator/rule-repository.js';

export interface FirecrawlResult {
  readonly html: string;
  readonly markdown?: string;
  readonly text?: string;
  readonly screenshotBase64?: string;
  readonly ocrTranscript?: readonly string[];
  readonly htmlChunks?: readonly DocumentHtmlChunkDefinition[];
}

export interface FirecrawlClient {
  fetchDocument(url: string): Promise<FirecrawlResult>;
}

interface FirecrawlClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
}

const ScreenshotSchema = z
  .object({
    data: z.string().optional(),
    base64: z.string().optional()
  })
  .partial();

const MediaEntrySchema = z
  .object({
    type: z.string().optional(),
    data: z.string().optional(),
    base64: z.string().optional()
  })
  .partial();

const ChunkSchema = z.object({
  id: z.string(),
  selector: z.string(),
  label: z.string().optional(),
  description: z.string().optional()
});

const FirecrawlResponseSchema = z
  .object({
    data: z
      .object({
        html: z.string().optional(),
        markdown: z.string().optional(),
        text: z.string().optional(),
        screenshot: ScreenshotSchema.optional(),
        media: z.array(MediaEntrySchema).optional(),
        chunks: z.array(ChunkSchema).optional(),
        transcript: z.array(z.string()).optional()
      })
      .partial()
      .optional(),
    html: z.string().optional(),
    markdown: z.string().optional(),
    text: z.string().optional()
  })
  .passthrough();

const pickFirstScreenshot = (
  response: z.infer<typeof FirecrawlResponseSchema>
): string | undefined => {
  const fromScreenshot = response.data?.screenshot?.data ?? response.data?.screenshot?.base64;
  if (fromScreenshot) {
    return fromScreenshot;
  }

  const mediaEntry = response.data?.media?.find((entry) => {
    const type = entry.type?.toLowerCase();
    return type ? type.includes('screenshot') || type.includes('image') : Boolean(entry.base64);
  });

  return mediaEntry?.base64 ?? mediaEntry?.data;
};

const pickHtml = (response: z.infer<typeof FirecrawlResponseSchema>): string | undefined => {
  return response.data?.html ?? response.html ?? undefined;
};

const pickMarkdown = (response: z.infer<typeof FirecrawlResponseSchema>): string | undefined => {
  return response.data?.markdown ?? response.markdown ?? undefined;
};

const pickText = (response: z.infer<typeof FirecrawlResponseSchema>): string | undefined => {
  return response.data?.text ?? response.text ?? undefined;
};

const pickTranscript = (
  response: z.infer<typeof FirecrawlResponseSchema>
): readonly string[] | undefined => {
  if (response.data?.transcript && response.data.transcript.length) {
    return response.data.transcript;
  }
  return undefined;
};

const pickChunks = (
  response: z.infer<typeof FirecrawlResponseSchema>
): readonly DocumentHtmlChunkDefinition[] | undefined => {
  const chunks = response.data?.chunks;
  if (!chunks) {
    return undefined;
  }
  return chunks.map((chunk) => ({
    id: chunk.id,
    selector: chunk.selector,
    label: chunk.label,
    description: chunk.description
  }));
};

class HttpFirecrawlClient implements FirecrawlClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: FirecrawlClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://api.firecrawl.dev/v1';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async fetchDocument(url: string): Promise<FirecrawlResult> {
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/scrape`;
    const requestBody = {
      url,
      formats: ['html', 'markdown', 'text', 'screenshot']
    };

    const response = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Firecrawl request failed: ${response.status} ${response.statusText}`);
    }

    const parsed = FirecrawlResponseSchema.parse(await response.json());

    const html = pickHtml(parsed);
    if (!html) {
      throw new Error('Firecrawl response did not include HTML content.');
    }

    return {
      html,
      markdown: pickMarkdown(parsed),
      text: pickText(parsed),
      screenshotBase64: pickFirstScreenshot(parsed),
      ocrTranscript: pickTranscript(parsed),
      htmlChunks: pickChunks(parsed)
    } satisfies FirecrawlResult;
  }
}

export const createFirecrawlClient = (options: FirecrawlClientOptions): FirecrawlClient => {
  return new HttpFirecrawlClient(options);
};

export const createFirecrawlClientFromEnv = (): FirecrawlClient | undefined => {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    return undefined;
  }

  const baseUrl = process.env.FIRECRAWL_API_URL?.trim();
  return createFirecrawlClient({ apiKey, baseUrl: baseUrl && baseUrl.length ? baseUrl : undefined });
};
