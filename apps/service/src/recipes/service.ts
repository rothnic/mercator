import { createDocumentToolset } from '@mercator/agent-tools';
import { RecipeSchema } from '@mercator/core';
import type { OrchestrationResult } from '@mercator/core/agents';
import type { FixtureToolset } from '@mercator/agent-tools';
import { executeRecipe } from './execute.js';
import { getFixtureDefinition, readFixtureDocument, type FixtureId } from './fixtures.js';
import { runAgentOrchestrationSlice, type DocumentSnapshot } from '../orchestrator/index.js';
import {
  createInMemoryRuleRepository,
  type DocumentHtmlChunkDefinition,
  type DocumentRuleRepository
} from '../orchestrator/rule-repository.js';
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
  readonly url?: string;
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
  readonly url?: string;
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

const normalizePath = (value: string): string => {
  return value.startsWith('/') ? value : `/${value}`;
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

  private assertDocumentSource(name: string, options: { url?: string | undefined; fixtureId?: FixtureId | undefined; htmlPath?: string | undefined }) {
    const hasUrl = typeof options.url === 'string' && options.url.trim().length > 0;
    if (!hasUrl) {
      return;
    }

    if (options.fixtureId || options.htmlPath) {
      throw new Error(`${name} accepts either a URL or fixture inputs, not both.`);
    }
  }

  private async fetchDocumentFromUrl(rawUrl: string): Promise<DocumentSnapshot> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid document URL: ${message}`);
    }

    const response = await fetch(parsed.toString(), {
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch document ${parsed.toString()}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return {
      domain: parsed.hostname,
      path: parsed.pathname ? normalizePath(parsed.pathname) : '/',
      html
    };
  }

  private async createToolsetForDocument(document: DocumentSnapshot): Promise<FixtureToolset> {
    const ruleSet = await this.ruleRepository.getRuleSet({
      domain: document.domain,
      path: document.path
    });

    if (!ruleSet) {
      throw new Error(
        `No rule configuration available for ${document.domain}${document.path}. Define rules for this document before running orchestration.`
      );
    }

    const chunkMetadata: readonly DocumentHtmlChunkDefinition[] | undefined = ruleSet.htmlChunks;
    return createDocumentToolset({
      documentId: ruleSet.id,
      html: document.html,
      ocrTranscript: ruleSet.providedOcrTranscript,
      chunkMetadata
    });
  }

  async generateRecipe(options: GenerateRecipeOptions = {}): Promise<GenerateRecipeResult> {
    this.assertDocumentSource('generateRecipe', options);

    let document: DocumentSnapshot;
    let toolset: FixtureToolset;

    const documentUrl = options.url?.trim();
    if (documentUrl) {
      document = await this.fetchDocumentFromUrl(documentUrl);
      toolset = await this.createToolsetForDocument(document);
    } else {
      const fixtureId = options.fixtureId ?? 'product-simple';
      const fixture = getFixtureDefinition(fixtureId);
      document = await readFixtureDocument(fixtureId, options.htmlPath);
      toolset = fixture.createToolset();
    }

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

    const stored = await this.store.createDraft(recipe, {
      actor: options.actor,
      notes: 'Recipe generated via orchestration.',
      when: this.now()
    });

    return { stored, orchestration, document };
  }

  promoteRecipe(id: string, options: PromoteRecipeOptions = {}): Promise<StoredRecipe> {
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

    this.assertDocumentSource('parseDocument', options);

    const documentUrl = options.url?.trim();
    const document = documentUrl
      ? await this.fetchDocumentFromUrl(documentUrl)
      : await readFixtureDocument(options.fixtureId ?? 'product-simple', options.htmlPath);
    const execution = executeRecipe(document.html, stable.recipe);

    return {
      recipe: stable,
      product: execution.product,
      fieldValues: execution.fieldValues,
      document
    };
  }
}
