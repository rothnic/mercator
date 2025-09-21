import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockScrape: vi.fn(),
  mockFindRecipesForDocument: vi.fn()
}));

vi.mock('../services/firecrawl-service', () => ({
  firecrawlService: {
    scrape: mocks.mockScrape
  }
}));

vi.mock('../services/recipe-directory', () => ({
  findRecipesForDocument: mocks.mockFindRecipesForDocument,
  findRecipesForUrl: vi.fn()
}));

import { scrapeUrlTool } from './scrape-url-tool';
import { getWorkspaceSnapshot, resetDocumentWorkspacesForTesting } from '../workspaces/document-workspace';

describe('scrapeUrlTool', () => {
  const sampleUrl = 'https://www.amazon.com/dp/B0D2WYHCZV';

  beforeEach(() => {
    resetDocumentWorkspacesForTesting();
    mocks.mockScrape.mockReset();
    mocks.mockFindRecipesForDocument.mockReset();
  });

  it('registers a workspace for the scraped document and returns the summary', async () => {
    mocks.mockScrape.mockResolvedValue({
      url: sampleUrl,
      domain: 'www.amazon.com',
      path: '/dp/B0D2WYHCZV',
      html: '<html><body><h1>Sample</h1></body></html>',
      markdown: '# Sample Product',
      screenshotUrl: 'https://example.test/screenshot.png',
      screenshotBase64: 'c2FtcGxlLWltYWdl'
    });

    mocks.mockFindRecipesForDocument.mockResolvedValue({
      stable: undefined,
      drafts: []
    });

    const result = await scrapeUrlTool.execute({
      context: { url: sampleUrl }
    });

    expect(mocks.mockScrape).toHaveBeenCalledWith(sampleUrl);
    expect(mocks.mockFindRecipesForDocument).toHaveBeenCalledWith('www.amazon.com', '/dp/B0D2WYHCZV');

    expect(result.url).toBe(sampleUrl);
    expect(result.domain).toBe('www.amazon.com');
    expect(result.path).toBe('/dp/B0D2WYHCZV');
    expect(result.refreshed).toBe(true);
    expect(result.hasScreenshot).toBe(true);
    expect(result.htmlLength).toBeGreaterThan(0);
    expect(result.markdownLength).toBeGreaterThan(0);
    expect(result.ocrPreview?.[0]).toBe('Sample Product');

    const snapshot = getWorkspaceSnapshot(result.workspaceId);
    expect(snapshot.domain).toBe('www.amazon.com');
    expect(snapshot.path).toBe('/dp/B0D2WYHCZV');

    const aliasedSnapshot = getWorkspaceSnapshot('workspace_0');
    expect(aliasedSnapshot.id).toBe(result.workspaceId);
  });
});
