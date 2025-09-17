import type { FieldRecipe } from '@mercator/core';
import type { Product } from '@mercator/core';
import type { RecipeFieldId } from '@mercator/core';

export type EvidenceSource = 'html' | 'markdown' | 'vision';

type HtmlEvidenceMode = 'first-text' | 'join-text';

interface EvidenceInstructionBase {
  readonly fieldId: RecipeFieldId;
  readonly source: EvidenceSource;
  readonly confidence: number;
  readonly chunkId?: string;
}

export interface HtmlEvidenceInstruction extends EvidenceInstructionBase {
  readonly kind: 'html-query';
  readonly selector: string;
  readonly limit?: number;
  readonly mode?: HtmlEvidenceMode;
  readonly joinWith?: string;
}

export interface MarkdownEvidenceInstruction extends EvidenceInstructionBase {
  readonly kind: 'markdown-search';
  readonly query: string;
  readonly caseSensitive?: boolean;
  readonly maxSnippets?: number;
}

export interface VisionEvidenceInstruction extends EvidenceInstructionBase {
  readonly kind: 'vision-ocr';
  readonly lineIndex?: number;
}

export type EvidenceInstruction =
  | HtmlEvidenceInstruction
  | MarkdownEvidenceInstruction
  | VisionEvidenceInstruction;

export interface FieldRuleDefinition {
  readonly recipe: FieldRecipe;
  readonly source: EvidenceSource;
  readonly chunkId?: string;
  readonly notes?: string;
  readonly confidence?: number;
}

export interface DocumentRuleSet {
  readonly id: string;
  readonly domain: string;
  readonly pathPattern: string;
  readonly documentType: string;
  readonly version: string;
  readonly expectedProduct: Product;
  readonly ruleMetadata: {
    readonly name: string;
    readonly description: string;
    readonly createdBy: string;
    readonly updatedBy: string;
  };
  readonly evidenceInstructions: readonly EvidenceInstruction[];
  readonly fieldRules: readonly FieldRuleDefinition[];
  readonly providedOcrTranscript?: readonly string[];
}

export interface DocumentRuleRepository {
  getRuleSet(request: { domain: string; path: string }): Promise<DocumentRuleSet | undefined>;
}

const escapePattern = (value: string): string => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

const compilePathPattern = (pattern: string): RegExp => {
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`;
  const replaced = escapePattern(normalized).replace(/:(\w+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${replaced}$`);
};

interface CompiledRule {
  readonly rule: DocumentRuleSet;
  readonly matcher: RegExp;
}

export const createInMemoryRuleRepository = (
  ruleSets: readonly DocumentRuleSet[]
): DocumentRuleRepository => {
  const compiled: CompiledRule[] = ruleSets.map((rule) => ({
    rule,
    matcher: compilePathPattern(rule.pathPattern)
  }));

  return {
    getRuleSet({ domain, path }) {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const entry = compiled.find(
        (candidate) => candidate.rule.domain === domain && candidate.matcher.test(normalizedPath)
      );
      return Promise.resolve(entry?.rule);
    }
  };
};
