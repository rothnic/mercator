import type { Product } from '../schemas.js';
import type { Recipe } from '../recipe.js';
import type { RecipeFieldId } from '../tolerances.js';

export type OrchestrationPassId =
  | 'pass-1-expected-data'
  | 'pass-2-recipe-synthesis'
  | 'pass-3-validation';

export interface AgentBudget {
  readonly maxPasses: number;
  readonly maxToolInvocations: number;
  readonly maxDurationMs: number;
  readonly startedAt: number;
}

export interface AgentToolInvocation {
  readonly id: string;
  readonly tool: string;
  readonly input: unknown;
  readonly timestamp: number;
}

export interface PassSummary<TResult> {
  readonly id: OrchestrationPassId;
  readonly label: string;
  readonly status: 'success' | 'failure';
  readonly startedAt: number;
  readonly completedAt: number;
  readonly notes: readonly string[];
  readonly toolUsage: readonly AgentToolInvocation[];
  readonly result: TResult;
}

export interface ExpectedFieldEvidence {
  readonly fieldId: RecipeFieldId;
  readonly source: 'html' | 'vision' | 'markdown';
  readonly snippet: string;
  readonly confidence: number;
  readonly chunkId?: string;
}

export interface ExpectedDataSummary {
  readonly fixtureId: string;
  readonly product: Product;
  readonly ocrTranscript: readonly string[];
  readonly supportingEvidence: readonly ExpectedFieldEvidence[];
  readonly origin: 'rule-set' | 'agent';
}

export interface RecipeEvidenceRow {
  readonly fieldId: RecipeFieldId;
  readonly source: 'html' | 'markdown' | 'vision';
  readonly selectors: readonly string[];
  readonly chunkId?: string;
  readonly notes?: string;
}

export interface AgentIterationLogEntry {
  readonly iteration: number;
  readonly agentThought: string;
  readonly updatedTargetData: Partial<Product>;
  readonly updatedSelectors: readonly {
    readonly fieldId: RecipeFieldId;
    readonly selector: string;
    readonly notes?: string;
  }[];
  readonly scrapedSamples: Readonly<Record<string, unknown>>;
}

export interface RecipeSynthesisSummary {
  readonly recipe: Recipe;
  readonly evidenceMatrix: readonly RecipeEvidenceRow[];
  readonly iterations: readonly AgentIterationLogEntry[];
  readonly origin: 'rule-set' | 'agent';
}

export interface FieldValidationResult {
  readonly fieldId: RecipeFieldId;
  readonly status: 'pass' | 'fail';
  readonly confidence: number;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly notes: readonly string[];
  readonly errors: readonly string[];
}

export interface DocumentValidationResult {
  readonly status: 'pass' | 'fail';
  readonly confidence: number;
  readonly fieldResults: readonly FieldValidationResult[];
  readonly errors: readonly string[];
  readonly stopReason?: string;
}

export interface OrchestrationResult {
  readonly startedAt: number;
  readonly completedAt: number;
  readonly budget: AgentBudget;
  readonly expected: ExpectedDataSummary;
  readonly synthesis: RecipeSynthesisSummary;
  readonly validation: DocumentValidationResult;
  readonly passes: readonly [
    PassSummary<ExpectedDataSummary>,
    PassSummary<RecipeSynthesisSummary>,
    PassSummary<DocumentValidationResult>
  ];
}

