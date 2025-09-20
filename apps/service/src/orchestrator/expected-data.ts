import type { FixtureToolset as AgentToolset } from '@mercator/agent-tools';
import type { ExpectedDataSummary, ExpectedFieldEvidence } from '@mercator/core/agents';

import type {
  DocumentRuleSet,
  EvidenceInstruction,
  HtmlEvidenceInstruction,
  MarkdownEvidenceInstruction,
  VisionEvidenceInstruction
} from './rule-repository.js';

const toSnippet = (text: string | undefined): string | undefined => {
  if (!text) {
    return undefined;
  }
  const snippet = text.replace(/\s+/g, ' ').trim();
  return snippet.length > 0 ? snippet : undefined;
};

const executeHtmlInstruction = async (
  toolset: AgentToolset,
  instruction: HtmlEvidenceInstruction
): Promise<string | undefined> => {
  const result = await toolset.html.query({
    selector: instruction.selector,
    chunkId: instruction.chunkId,
    limit: instruction.limit
  });

  if (!result.matches.length) {
    return undefined;
  }

  const mode = instruction.mode ?? 'first-text';
  if (mode === 'join-text') {
    const joined = result.matches.map((match) => match.text).filter(Boolean).join(instruction.joinWith ?? ' ');
    return toSnippet(joined);
  }

  const [first] = result.matches;
  return toSnippet(first?.text);
};

const executeMarkdownInstruction = async (
  toolset: AgentToolset,
  instruction: MarkdownEvidenceInstruction
): Promise<string | undefined> => {
  const result = await toolset.markdown.search({
    query: instruction.query,
    caseSensitive: instruction.caseSensitive,
    maxSnippets: instruction.maxSnippets
  });

  const [first] = result.matches;
  return toSnippet(first?.excerpt);
};

const executeVisionInstruction = (
  transcript: readonly string[] | undefined,
  instruction: VisionEvidenceInstruction
): string | undefined => {
  if (!transcript || transcript.length === 0) {
    return undefined;
  }

  const index = instruction.lineIndex ?? 0;
  return toSnippet(transcript[index]);
};

const collectEvidence = async (
  toolset: AgentToolset,
  instructions: readonly EvidenceInstruction[],
  transcript: readonly string[] | undefined
): Promise<ExpectedFieldEvidence[]> => {
  const entries: ExpectedFieldEvidence[] = [];

  for (const instruction of instructions) {
    let snippet: string | undefined;

    switch (instruction.kind) {
      case 'html-query':
        snippet = await executeHtmlInstruction(toolset, instruction);
        break;
      case 'markdown-search':
        snippet = await executeMarkdownInstruction(toolset, instruction);
        break;
      case 'vision-ocr':
        snippet = executeVisionInstruction(transcript, instruction);
        break;
      default:
        snippet = undefined;
    }

    if (!snippet) {
      continue;
    }

    entries.push({
      fieldId: instruction.fieldId,
      source: instruction.source,
      snippet,
      confidence: instruction.confidence,
      chunkId: instruction.chunkId
    });
  }

  return entries;
};

export interface ExpectedDataCollectorOptions {
  readonly ruleSet: DocumentRuleSet;
  readonly toolset: AgentToolset;
}

export const collectExpectedData = async (
  options: ExpectedDataCollectorOptions
): Promise<ExpectedDataSummary> => {
  const { ruleSet, toolset } = options;
  const requiresOcr = ruleSet.evidenceInstructions.some((instruction) => instruction.kind === 'vision-ocr');

  const ocrResult = requiresOcr ? await toolset.vision.readOcr() : undefined;
  const transcript = ocrResult?.lines ?? ruleSet.providedOcrTranscript ?? [];

  const supportingEvidence = await collectEvidence(toolset, ruleSet.evidenceInstructions, transcript);

  return {
    fixtureId: ruleSet.id,
    product: ruleSet.expectedProduct,
    ocrTranscript: transcript,
    supportingEvidence,
    origin: 'rule-set'
  };
};
