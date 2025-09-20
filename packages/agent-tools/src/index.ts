import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { ElementType } from 'domelementtype';
import type { AnyNode, Element } from 'domhandler';

import {
  listProductSimpleHtmlChunks,
  loadProductSimpleFixture,
  PRODUCT_SIMPLE_FIXTURE_ID
} from '@mercator/fixtures';

export interface ToolUsageEntry<TInput = unknown> {
  readonly id: string;
  readonly tool: string;
  readonly input: TInput;
  readonly timestamp: number;
}

export interface VisionOcrRequest {
  readonly region?: string;
}

export interface VisionOcrResult {
  readonly fixtureId: string;
  readonly lines: readonly string[];
  readonly fullText: string;
  readonly region?: string;
}

export interface HtmlChunkDefinition {
  readonly id: string;
  readonly selector: string;
  readonly label?: string;
  readonly description?: string;
}

export interface HtmlChunkSummary extends HtmlChunkDefinition {
  readonly snippet: string;
  readonly nodeCount: number;
}

export interface HtmlQueryRequest {
  readonly selector: string;
  readonly attribute?: string;
  readonly chunkId?: string;
  readonly limit?: number;
}

export interface HtmlQueryMatch {
  readonly html: string;
  readonly text: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly attributeValue?: string;
  readonly path: string;
}

export interface HtmlQueryResult {
  readonly fixtureId: string;
  readonly totalMatches: number;
  readonly matches: readonly HtmlQueryMatch[];
  readonly chunk?: HtmlChunkSummary;
}

export interface MarkdownSearchRequest {
  readonly query: string;
  readonly caseSensitive?: boolean;
  readonly maxSnippets?: number;
}

export interface MarkdownSearchMatch {
  readonly heading: string | null;
  readonly excerpt: string;
  readonly lineRange: readonly [number, number];
}

export interface MarkdownSearchResult {
  readonly fixtureId: string;
  readonly totalMatches: number;
  readonly matches: readonly MarkdownSearchMatch[];
}

export interface FixtureToolset {
  readonly vision: {
    readOcr(request?: VisionOcrRequest): Promise<VisionOcrResult>;
  };
  readonly html: {
    listChunks(): Promise<readonly HtmlChunkSummary[]>;
    query(request: HtmlQueryRequest): Promise<HtmlQueryResult>;
  };
  readonly markdown: {
    search(request: MarkdownSearchRequest): Promise<MarkdownSearchResult>;
  };
  readonly getUsageLog: () => readonly ToolUsageEntry[];
  readonly resetUsageLog: () => void;
}

const cloneInput = (input: unknown): unknown => {
  if (input === undefined || input === null) {
    return input;
  }

  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return input;
  }
};

const createUsageRecorder = () => {
  const entries: ToolUsageEntry[] = [];
  let counter = 0;

  const record = (tool: string, input: unknown) => {
    counter += 1;
    entries.push({
      id: `${tool}#${counter}`,
      tool,
      input: cloneInput(input),
      timestamp: Date.now()
    });
  };

  const getUsageLog = (): readonly ToolUsageEntry[] => entries.map((entry) => ({ ...entry }));

  const resetUsageLog = () => {
    entries.length = 0;
    counter = 0;
  };

  return { record, getUsageLog, resetUsageLog };
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const isElementNode = (node: AnyNode | null | undefined): node is Element =>
  node !== null && node !== undefined && node.type === ElementType.Tag;

const buildCssPath = ($: CheerioAPI, node: Element): string => {
  const segments: string[] = [];
  let current: Element | undefined | null = node;

  while (current && current.type === ElementType.Tag) {
    let segment = current.name;
    if (!segment) {
      break;
    }

    if (current.attribs?.id) {
      segment += `#${current.attribs.id}`;
      segments.push(segment);
      break;
    }

    if (current.attribs?.class) {
      const [firstClass] = current.attribs.class
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      if (firstClass) {
        segment += `.${firstClass}`;
      }
    }

    const parent: Element | undefined = isElementNode(current.parent) ? current.parent : undefined;
    if (parent) {
      const siblings = (parent.children as AnyNode[]).filter(
        (child): child is Element => isElementNode(child) && child.name === current?.name
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    segments.push(segment);
    current = parent ?? undefined;
  }

  return segments.reverse().join(' > ');
};

interface MarkdownSection {
  readonly heading: string | null;
  readonly lines: readonly string[];
  readonly startLine: number;
}

const splitMarkdownSections = (markdown: string): MarkdownSection[] => {
  const lines = markdown.split(/\r?\n/);
  const sections: MarkdownSection[] = [];

  let currentHeading: string | null = null;
  let currentLines: string[] = [];
  let currentStart = 1;

  const pushSection = () => {
    if (currentLines.length === 0 && currentHeading === null) {
      return;
    }
    sections.push({ heading: currentHeading, lines: [...currentLines], startLine: currentStart });
    currentLines = [];
  };

  lines.forEach((line, index) => {
    const headingMatch = /^#{1,6}\s+(.*)$/.exec(line.trim());
    if (headingMatch) {
      pushSection();
      currentHeading = headingMatch[1].trim();
      currentStart = index + 1;
      currentLines = [];
      return;
    }

    if (currentLines.length === 0 && currentHeading === null && line.trim().length === 0) {
      currentStart = index + 2;
      return;
    }

    currentLines.push(line);
  });

  pushSection();
  return sections;
};

const createHtmlChunkSummaries = (
  $: CheerioAPI,
  metadata: readonly HtmlChunkDefinition[]
): HtmlChunkSummary[] => {
  return metadata.map((chunk) => {
    const nodes = $(chunk.selector);
    const text = collapseWhitespace(nodes.first().text() ?? '');
    return {
      ...chunk,
      snippet: text.slice(0, 240),
      nodeCount: nodes.length
    };
  });
};

const resolveChunkRoot = (
  $: CheerioAPI,
  metadata: Map<string, HtmlChunkDefinition>,
  chunkId?: string
): { root: Cheerio<Element>; summary?: HtmlChunkSummary } => {
  const fallbackRoot = $('html');
  if (!chunkId) {
    return { root: fallbackRoot };
  }

  const chunk = metadata.get(chunkId);
  if (!chunk) {
    return { root: fallbackRoot };
  }

  const nodes = $(chunk.selector);
  const elementNodes = nodes.filter((_, node): node is Element => isElementNode(node));
  const selection = elementNodes.first();
  if (!selection.length) {
    return { root: fallbackRoot };
  }

  return {
    root: selection,
    summary: {
      ...chunk,
      snippet: collapseWhitespace(selection.text()).slice(0, 240),
      nodeCount: elementNodes.length
    }
  };
};

const createHtmlQueryMatches = (
  $: CheerioAPI,
  root: Cheerio<Element>,
  request: HtmlQueryRequest
): HtmlQueryMatch[] => {
  const limit = request.limit ?? 5;
  const matches: HtmlQueryMatch[] = [];
  const nodes = root.find(request.selector).toArray() as AnyNode[];
  const elements = nodes.filter(isElementNode);

  for (const element of elements.slice(0, limit)) {
    const html = $.html(element)?.trim() ?? '';
    const elementWrapper = $(element);
    const text = collapseWhitespace(elementWrapper.text() ?? '');
    const attributes = { ...(element.attribs ?? {}) };
    const attributeValue = request.attribute ? element.attribs?.[request.attribute] : undefined;

    matches.push({
      html,
      text,
      attributes,
      attributeValue,
      path: buildCssPath($, element)
    });
  }

  return matches;
};

const computeMarkdownMatches = (sections: MarkdownSection[], request: MarkdownSearchRequest) => {
  const query = request.caseSensitive ? request.query : request.query.toLowerCase();
  const limit = request.maxSnippets ?? 3;
  const matches: MarkdownSearchMatch[] = [];

  sections.forEach((section) => {
    const joined = section.lines.join('\n');
    const haystack = request.caseSensitive ? joined : joined.toLowerCase();
    if (!haystack.includes(query)) {
      return;
    }

    const start = section.startLine;
    const end = section.startLine + Math.max(section.lines.length - 1, 0);
    matches.push({
      heading: section.heading,
      excerpt: collapseWhitespace(joined).slice(0, 280),
      lineRange: [start, end]
    });
  });

  return {
    matches: matches.slice(0, limit),
    totalMatches: matches.length
  };
};

export interface DocumentToolsetOptions {
  readonly documentId?: string;
  readonly html: string;
  readonly chunkMetadata?: readonly HtmlChunkDefinition[];
  readonly markdown?: string;
  readonly ocrTranscript?: readonly string[];
}

export const createDocumentToolset = (options: DocumentToolsetOptions): FixtureToolset => {
  const documentId = options.documentId ?? 'document';
  const $ = load(options.html);
  const chunkMetadata = options.chunkMetadata ?? [];
  const chunkLookup = new Map(chunkMetadata.map((chunk) => [chunk.id, chunk]));
  const chunkSummaries = createHtmlChunkSummaries($, chunkMetadata);
  const markdownSections = options.markdown ? splitMarkdownSections(options.markdown) : [];
  const usage = createUsageRecorder();
  const transcript = options.ocrTranscript ?? [];

  return {
    vision: {
      readOcr(request: VisionOcrRequest = {}): Promise<VisionOcrResult> {
        usage.record('vision.ocr', request);
        return Promise.resolve({
          fixtureId: documentId,
          lines: [...transcript],
          fullText: transcript.join('\n'),
          region: request.region
        });
      }
    },
    html: {
      listChunks(): Promise<readonly HtmlChunkSummary[]> {
        usage.record('html.listChunks', {});
        return Promise.resolve(chunkSummaries.map((chunk) => ({ ...chunk })));
      },
      query(request: HtmlQueryRequest): Promise<HtmlQueryResult> {
        if (!request.selector) {
          throw new Error('Selector is required for html.query');
        }
        usage.record('html.query', request);
        const { root, summary } = resolveChunkRoot($, chunkLookup, request.chunkId);
        const matches = createHtmlQueryMatches($, root, request);
        const totalMatches = root.find(request.selector).length;
        return Promise.resolve({
          fixtureId: documentId,
          totalMatches,
          matches,
          chunk: summary
        });
      }
    },
    markdown: {
      search(request: MarkdownSearchRequest): Promise<MarkdownSearchResult> {
        if (!request.query.trim()) {
          throw new Error('Query must not be empty');
        }
        usage.record('markdown.search', request);
        if (!options.markdown) {
          return Promise.resolve({ fixtureId: documentId, matches: [], totalMatches: 0 });
        }
        const { matches, totalMatches } = computeMarkdownMatches(markdownSections, request);
        return Promise.resolve({
          fixtureId: documentId,
          matches,
          totalMatches
        });
      }
    },
    getUsageLog: () => usage.getUsageLog(),
    resetUsageLog: () => usage.resetUsageLog()
  };
};

export const createFixtureToolset = (options?: { fixtureId?: string }): FixtureToolset => {
  const fixtureId = options?.fixtureId ?? PRODUCT_SIMPLE_FIXTURE_ID;
  if (fixtureId !== PRODUCT_SIMPLE_FIXTURE_ID) {
    throw new Error(`Unsupported fixture id: ${fixtureId}`);
  }

  const fixture = loadProductSimpleFixture();
  const chunkMetadata = listProductSimpleHtmlChunks();

  return createDocumentToolset({
    documentId: fixture.id,
    html: fixture.html,
    markdown: fixture.markdown,
    ocrTranscript: fixture.expected.ocrTranscript,
    chunkMetadata
  });
};
