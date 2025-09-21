import { beforeEach, describe, expect, it } from 'vitest';

import { documentInsightTool } from './document-insight-tool';
import {
  registerDocumentWorkspace,
  resetDocumentWorkspacesForTesting
} from '../workspaces/document-workspace';
import { loadProductSimpleFixture } from '@mercator/fixtures';

const WORKSPACE_URL = 'https://demo.mercator.sh/products/precision-pour-over-kettle';

describe('documentInsightTool', () => {
  beforeEach(() => {
    resetDocumentWorkspacesForTesting();
  });

  const setupWorkspace = () => {
    const fixture = loadProductSimpleFixture();
    const screenshotBase64 = fixture.screenshot.toString('base64');

    return registerDocumentWorkspace({
      url: WORKSPACE_URL,
      domain: 'demo.mercator.sh',
      path: '/products/precision-pour-over-kettle',
      html: fixture.html,
      markdown: fixture.markdown,
      screenshotUrl: 'https://cdn.mercator.sh/assets/kettle/precision-pour-over-kettle.jpg',
      screenshotBase64,
      ocrTranscript: fixture.expected.ocrTranscript
    });
  };

  it('returns workspace overview with screenshot metadata', async () => {
    const snapshot = setupWorkspace();

    const result = await documentInsightTool.execute({
      context: { action: 'overview', workspaceId: snapshot.id }
    });

    expect(result.action).toBe('overview');
    expect(result.workspace.hasScreenshot).toBe(true);
    expect(result.workspace.screenshotUrl).toContain('precision-pour-over-kettle');
  });

  it('searches HTML text snippets without returning the full document', async () => {
    const snapshot = setupWorkspace();

    const result = await documentInsightTool.execute({
      context: {
        action: 'htmlSearch',
        workspaceId: snapshot.id,
        query: 'Precision Pour-Over',
        limit: 3
      }
    });

    expect(result.action).toBe('htmlSearch');
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.matches[0]?.textSnippet).toContain('Precision Pour-Over');
    expect(result.matches[0]?.htmlSnippet.length).toBeLessThanOrEqual(1200);
  });

  it('reads OCR transcript slices with pagination metadata', async () => {
    const snapshot = setupWorkspace();

    const result = await documentInsightTool.execute({
      context: {
        action: 'visionOcr',
        workspaceId: snapshot.id,
        maxLines: 2
      }
    });

    expect(result.action).toBe('visionOcr');
    const totalLines = typeof result.totalLines === 'number' ? result.totalLines : 0;
    const returnedLines = typeof result.returnedLines === 'number' ? result.returnedLines : 0;
    expect(totalLines >= returnedLines).toBe(true);
    expect(returnedLines <= 2).toBe(true);
    expect(Array.isArray(result.lines)).toBe(true);
    if (typeof result.preview === 'string') {
      expect(result.preview.length).toBeLessThanOrEqual(400);
    }
  });
});
