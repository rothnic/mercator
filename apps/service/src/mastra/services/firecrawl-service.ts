import { Buffer } from 'node:buffer';

export interface FirecrawlScrapeResult {
  readonly url: string;
  readonly domain: string;
  readonly path: string;
  readonly html: string;
  readonly markdown: string;
  readonly screenshotUrl?: string;
  readonly screenshotBase64?: string;
}

interface FirecrawlApiResponse {
  readonly success: boolean;
  readonly data?: {
    readonly html: string;
    readonly markdown: string;
    readonly screenshot?: string;
    readonly metadata?: {
      readonly error?: string;
      readonly [key: string]: unknown;
    };
  };
  readonly error?: string;
}

const API_URL = 'https://api.firecrawl.dev/v2/scrape';

const toBase64 = async (imageUrl: string): Promise<string> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Firecrawl screenshot: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
};

export const firecrawlService = {
  async scrape(url: string): Promise<FirecrawlScrapeResult> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error('FIRECRAWL_API_KEY is not configured. Set the key before invoking the ingestion workflow.');
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid URL provided to Firecrawl scrape: ${reason}`);
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: parsed.toString(),
        onlyMainContent: true,
        formats: ['markdown', 'html', { type: 'screenshot', fullPage: true }]
      })
    });

    const payload = (await response.json()) as FirecrawlApiResponse;
    if (!response.ok || !payload.success || !payload.data) {
      const reason = payload.data?.metadata?.error ?? payload.error ?? `${response.status} ${response.statusText}`;
      throw new Error(`Firecrawl scrape failed: ${reason}`);
    }

    const screenshotUrl = payload.data.screenshot;
    const screenshotBase64 = screenshotUrl ? await toBase64(screenshotUrl) : undefined;

    return {
      url: parsed.toString(),
      domain: parsed.hostname,
      path: parsed.pathname || '/',
      html: payload.data.html,
      markdown: payload.data.markdown,
      screenshotUrl,
      screenshotBase64
    };
  }
};
