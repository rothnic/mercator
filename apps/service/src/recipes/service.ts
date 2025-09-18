import { RecipeSchema } from '@mercator/core';
import type { OrchestrationResult } from '@mercator/core/agents';
import { executeRecipe } from './execute.js';
import { getFixtureDefinition, readFixtureDocument, type FixtureId } from './fixtures.js';
import { runAgentOrchestrationSlice, type DocumentSnapshot } from '../orchestrator/index.js';
import { createInMemoryRuleRepository, type DocumentRuleRepository } from '../orchestrator/rule-repository.js';
import type { RecipeStore, StoredRecipe } from '@mercator/recipe-store';

export interface RecipeWorkflowServiceOptions {
  readonly store: RecipeStore;
  readonly ruleRepository?: DocumentRuleRepository;
  readonly now?: () => Date;
}

export interface GenerateRecipeOptions {
  readonly fixtureId?: FixtureId;
  readonly htmlPath?: string;
  readonly actor?: string;
}

export interface GenerateRecipeResult {
  readonly stored: StoredRecipe;
  readonly orchestration: OrchestrationResult;
  readonly document: DocumentSnapshot;
}

export interface PromoteRecipeOptions {
  readonly actor?: string;
  readonly notes?: string;
}

export interface ParseDocumentOptions {
  readonly fixtureId?: FixtureId;
  readonly htmlPath?: string;
}

export interface ParseDocumentResult {
  readonly recipe: StoredRecipe;
  readonly product: ReturnType<typeof executeRecipe>['product'];
  readonly fieldValues: ReturnType<typeof executeRecipe>['fieldValues'];
  readonly document: DocumentSnapshot;
}

const createDefaultRuleRepository = (): DocumentRuleRepository => {
  const fixture = getFixtureDefinition('product-simple');
  return createInMemoryRuleRepository([fixture.createRuleSet()]);
};

export class RecipeWorkflowService {
  private readonly store: RecipeStore;
  private readonly ruleRepository: DocumentRuleRepository;
  private readonly now: () => Date;

  constructor(options: RecipeWorkflowServiceOptions) {
    this.store = options.store;
    this.ruleRepository = options.ruleRepository ?? createDefaultRuleRepository();
    this.now = options.now ?? (() => new Date());
  }

  async generateRecipe(options: GenerateRecipeOptions = {}): Promise<GenerateRecipeResult> {
    const fixtureId = options.fixtureId ?? 'product-simple';
    const fixture = getFixtureDefinition(fixtureId);
    const document = await readFixtureDocument(fixtureId, options.htmlPath);
    const toolset = fixture.createToolset();

    const orchestration: OrchestrationResult = await runAgentOrchestrationSlice({
      document,
      toolset,
      ruleRepository: this.ruleRepository,
      now: this.now
    });

    const parseResult = RecipeSchema.safeParse(orchestration.synthesis.recipe);
    if (!parseResult.success) {
      throw new Error('Generated recipe failed schema validation.');
    }

    const { data: recipe } = parseResult;

    // The recipe has been validated via Zod safeParse, but zod's typings cause
    // eslint to treat the value as `any` here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const stored = await this.store.createDraft(recipe, {
      actor: options.actor,
      notes: 'Recipe generated via orchestration.',
      when: this.now()
    });

    return { stored, orchestration, document };
  }

  async promoteRecipe(id: string, options: PromoteRecipeOptions = {}): Promise<StoredRecipe> {
    return this.store.promote(id, {
      actor: options.actor,
      notes: options.notes ?? 'Promoted via workflow service.',
      when: this.now()
    });
  }

  async parseDocument(options: ParseDocumentOptions = {}): Promise<ParseDocumentResult> {
    const stable = await this.store.getLatestStable();
    if (!stable) {
      throw new Error('No stable recipe available for execution.');
    }

    const fixtureId = options.fixtureId ?? 'product-simple';
    const document = await readFixtureDocument(fixtureId, options.htmlPath);
    const execution = executeRecipe(document.html, stable.recipe);

    return {
      recipe: stable,
      product: execution.product,
      fieldValues: execution.fieldValues,
      document
    };
  }
}
